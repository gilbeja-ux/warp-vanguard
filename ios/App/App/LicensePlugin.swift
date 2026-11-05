import Foundation
import Capacitor
import StoreKit

/// THE LICENSE, iOS HALF (2026-11-05). One non-consumable product opens
/// contracts 3, 4 and 5; the page (src/game/34-license.js) owns every rule and
/// sends the product id with each call, so no id lives here. Its twin is
/// android/app/src/main/java/com/warpvanguard/game/LicensePlugin.java; the two
/// answer in the same shape:
///
///     { owned: Bool, price: String?, state: String }
///     state: owned | none | cancelled | pending | error | unavailable
///
/// StoreKit 2 directly, no third-party processor in between: nothing about a
/// purchase leaves the device except to Apple. iOS 15 is the deployment floor,
/// and StoreKit 2's floor too. The page caches the answer and never waits on
/// this to let anyone play.
///
/// GameViewController registers it (capacitorDidLoad): it is the app's own
/// plugin, not an npm package, so Capacitor cannot find it by itself.
///
/// `@unchecked Sendable`: the update task outlives the call that started it and
/// reaches back for `notifyListeners`, which hands its event to the bridge. The
/// only state the plugin keeps is that task, written once in `load()`.
@objc(LicensePlugin)
public class LicensePlugin: CAPPlugin, CAPBridgedPlugin, @unchecked Sendable {
    public let identifier = "LicensePlugin"
    public let jsName = "License"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "query", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "buy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise)
    ]

    private var updates: Task<Void, Never>?

    /// Every transaction StoreKit delivers while the app runs: an Ask to Buy
    /// approved, a pending payment cleared, a purchase made on another device.
    /// Each is finished, and the page is told "something changed" and asks again.
    override public func load() {
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                guard case .verified(let tx) = result else { continue }
                await tx.finish()
                DispatchQueue.main.async { self?.notifyListeners("licenseChanged", data: [:]) }
            }
        }
    }

    deinit { updates?.cancel() }

    private func answer(_ owned: Bool, _ price: String?, _ state: String) -> [String: Any] {
        var d: [String: Any] = ["owned": owned, "state": state]
        if let p = price { d["price"] = p }
        return d
    }

    /// The current entitlements: verified, not revoked (a refund revokes).
    private func owns(_ id: String) async -> Bool {
        for await result in Transaction.currentEntitlements {
            if case .verified(let tx) = result, tx.productID == id, tx.revocationDate == nil { return true }
        }
        return false
    }

    private func product(_ id: String) async -> Product? {
        guard !id.isEmpty, let list = try? await Product.products(for: [id]) else { return nil }
        return list.first
    }

    @objc func query(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            let owned = await owns(id)
            let p = await product(id)
            call.resolve(answer(owned, p?.displayPrice, owned ? "owned" : "none"))
        }
    }

    @objc func buy(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            guard let p = await product(id) else {
                call.resolve(answer(false, nil, "unavailable"))
                return
            }
            do {
                switch try await p.purchase() {
                case .success(let verification):
                    if case .verified(let tx) = verification {
                        await tx.finish()
                        call.resolve(answer(true, p.displayPrice, "owned"))
                    } else {
                        call.resolve(answer(false, p.displayPrice, "error"))
                    }
                case .userCancelled:
                    call.resolve(answer(false, p.displayPrice, "cancelled"))
                case .pending:
                    // Ask to Buy, or a payment that needs action: Transaction.updates
                    // delivers it when it clears, and the page asks again then
                    call.resolve(answer(false, p.displayPrice, "pending"))
                @unknown default:
                    call.resolve(answer(false, p.displayPrice, "error"))
                }
            } catch {
                call.resolve(answer(false, p.displayPrice, "error"))
            }
        }
    }

    /// RESTORE PURCHASE: App Review asks for one. AppStore.sync() makes StoreKit
    /// fetch this Apple Account's transactions afresh (it may show a sign-in
    /// sheet); the entitlements are then read exactly as the query reads them.
    @objc func restore(_ call: CAPPluginCall) {
        let id = call.getString("id") ?? ""
        Task {
            var synced = true
            do { try await AppStore.sync() } catch { synced = false } // a closed sign-in sheet lands here
            let owned = await owns(id)
            let p = await product(id)
            call.resolve(answer(owned, p?.displayPrice, owned ? "owned" : synced ? "none" : "error"))
        }
    }
}
