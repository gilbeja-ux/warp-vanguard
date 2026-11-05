package com.warpvanguard.game;

import com.android.billingclient.api.AcknowledgePurchaseParams;
import com.android.billingclient.api.BillingClient;
import com.android.billingclient.api.BillingClientStateListener;
import com.android.billingclient.api.BillingFlowParams;
import com.android.billingclient.api.BillingResult;
import com.android.billingclient.api.PendingPurchasesParams;
import com.android.billingclient.api.ProductDetails;
import com.android.billingclient.api.Purchase;
import com.android.billingclient.api.PurchasesUpdatedListener;
import com.android.billingclient.api.QueryProductDetailsParams;
import com.android.billingclient.api.QueryPurchasesParams;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * THE LICENSE, ANDROID HALF (2026-11-05). One non-consumable product opens
 * contracts 3, 4 and 5; the page (src/game/34-license.js) owns every rule and
 * sends the product id with each call, so no id lives here. Its twin is
 * ios/App/App/LicensePlugin.swift; the two answer in the same shape:
 *
 *   { owned: boolean, price: string | null, state: string }
 *   state: owned | none | cancelled | pending | error | unavailable
 *
 * Play Billing directly, no third-party processor in between: nothing about a
 * purchase leaves the device except to Google. The page caches the answer and
 * never waits on this to let anyone play.
 *
 * A non-consumable must be ACKNOWLEDGED within three days or Play refunds it.
 * Every path that sees a purchased, unacknowledged unlock acknowledges it: the
 * purchase sheet's own answer and every query (boot, offer, restore), so a
 * purchase whose answer was lost to a killed app is acknowledged next boot.
 */
@CapacitorPlugin(name = "License")
public class LicensePlugin extends Plugin implements PurchasesUpdatedListener {
    private BillingClient billing;
    private boolean connecting = false;
    private final List<Runnable> waiting = new ArrayList<>();
    private final List<PluginCall> waitingCalls = new ArrayList<>();
    private PluginCall buying = null;      // the one purchase sheet that can be open
    private String buyingId = null;
    private ProductDetails details = null; // cached after the first lookup

    @Override
    public void load() {
        billing = BillingClient.newBuilder(getContext())
                .setListener(this)
                // a "pending" payment (cash at a shop, a slow bank) is allowed;
                // the unlock lands when Play says it cleared
                .enablePendingPurchases(PendingPurchasesParams.newBuilder().enableOneTimeProducts().build())
                .enableAutoServiceReconnection()
                .build();
        connect();
    }

    // ---- the connection, and the calls that wait for it ----
    private void connect() {
        if (connecting || billing.isReady()) return;
        connecting = true;
        billing.startConnection(new BillingClientStateListener() {
            @Override
            public void onBillingSetupFinished(BillingResult r) {
                connecting = false;
                List<Runnable> run;
                List<PluginCall> calls;
                synchronized (waiting) {
                    run = new ArrayList<>(waiting);
                    calls = new ArrayList<>(waitingCalls);
                    waiting.clear();
                    waitingCalls.clear();
                }
                if (r.getResponseCode() == BillingClient.BillingResponseCode.OK) {
                    for (Runnable t : run) t.run();
                } else {
                    for (PluginCall c : calls) c.resolve(answer(false, null, "unavailable"));
                }
            }

            @Override
            public void onBillingServiceDisconnected() {
                connecting = false; // auto-reconnection takes it from here
            }
        });
    }

    private void whenReady(PluginCall call, Runnable then) {
        if (billing.isReady()) { then.run(); return; }
        synchronized (waiting) { waiting.add(then); waitingCalls.add(call); }
        connect();
    }

    private static JSObject answer(boolean owned, String price, String state) {
        JSObject o = new JSObject();
        o.put("owned", owned);
        o.put("price", price);
        o.put("state", state);
        return o;
    }

    private String price() {
        if (details == null || details.getOneTimePurchaseOfferDetails() == null) return null;
        return details.getOneTimePurchaseOfferDetails().getFormattedPrice();
    }

    // the product's details: its localized price, and what the purchase sheet needs
    private void lookUp(String id, Runnable then) {
        if (details != null && details.getProductId().equals(id)) { then.run(); return; }
        QueryProductDetailsParams q = QueryProductDetailsParams.newBuilder()
                .setProductList(Collections.singletonList(QueryProductDetailsParams.Product.newBuilder()
                        .setProductId(id)
                        .setProductType(BillingClient.ProductType.INAPP)
                        .build()))
                .build();
        billing.queryProductDetailsAsync(q, (r, result) -> {
            if (r.getResponseCode() == BillingClient.BillingResponseCode.OK && result != null) {
                for (ProductDetails d : result.getProductDetailsList()) {
                    if (d.getProductId().equals(id)) details = d;
                }
            }
            then.run();
        });
    }

    private void acknowledge(Purchase p) {
        if (p.getPurchaseState() != Purchase.PurchaseState.PURCHASED || p.isAcknowledged()) return;
        billing.acknowledgePurchase(
                AcknowledgePurchaseParams.newBuilder().setPurchaseToken(p.getPurchaseToken()).build(),
                r -> { /* a failure is retried by the next query */ });
    }

    // ---- query: does this Play account hold the unlock? ----
    private void ownedNow(String id, PluginCall call) {
        billing.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(BillingClient.ProductType.INAPP).build(),
                (r, purchases) -> {
                    if (r.getResponseCode() != BillingClient.BillingResponseCode.OK) {
                        call.resolve(answer(false, price(), "error"));
                        return;
                    }
                    boolean owned = false;
                    boolean pending = false;
                    for (Purchase p : purchases) {
                        if (!p.getProducts().contains(id)) continue;
                        if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) { owned = true; acknowledge(p); }
                        else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
                    }
                    final boolean o = owned, pe = pending;
                    lookUp(id, () -> call.resolve(answer(o, price(), o ? "owned" : pe ? "pending" : "none")));
                });
    }

    @PluginMethod
    public void query(PluginCall call) {
        String id = call.getString("id", "");
        whenReady(call, () -> ownedNow(id, call));
    }

    // Play restores on its own: the query IS the restore. Kept as its own
    // method so the page speaks to both shells the same way.
    @PluginMethod
    public void restore(PluginCall call) {
        String id = call.getString("id", "");
        whenReady(call, () -> ownedNow(id, call));
    }

    @PluginMethod
    public void buy(PluginCall call) {
        String id = call.getString("id", "");
        if (buying != null) { call.resolve(answer(false, price(), "error")); return; }
        whenReady(call, () -> lookUp(id, () -> {
            if (details == null) { call.resolve(answer(false, null, "unavailable")); return; }
            BillingFlowParams params = BillingFlowParams.newBuilder()
                    .setProductDetailsParamsList(Collections.singletonList(
                            BillingFlowParams.ProductDetailsParams.newBuilder().setProductDetails(details).build()))
                    .build();
            buying = call;
            buyingId = id;
            getActivity().runOnUiThread(() -> {
                BillingResult r = billing.launchBillingFlow(getActivity(), params);
                int code = r.getResponseCode();
                if (code == BillingClient.BillingResponseCode.OK) return; // onPurchasesUpdated answers
                finishBuy(code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED
                        ? answer(true, price(), "owned")
                        : code == BillingClient.BillingResponseCode.USER_CANCELED
                        ? answer(false, price(), "cancelled")
                        : answer(false, price(), "error"));
            });
        }));
    }

    private void finishBuy(JSObject a) {
        PluginCall c = buying;
        buying = null;
        buyingId = null;
        if (c != null) c.resolve(a);
    }

    // The purchase sheet's answer, and every later change Play tells us about
    // while the app runs (a pending payment clearing, a purchase on another
    // device). The page is told "something changed" and asks again.
    @Override
    public void onPurchasesUpdated(BillingResult r, List<Purchase> purchases) {
        int code = r.getResponseCode();
        String id = buyingId;
        boolean owned = false;
        boolean pending = false;
        if (code == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (Purchase p : purchases) {
                if (id != null && !p.getProducts().contains(id)) continue;
                if (p.getPurchaseState() == Purchase.PurchaseState.PURCHASED) { owned = true; acknowledge(p); }
                else if (p.getPurchaseState() == Purchase.PurchaseState.PENDING) pending = true;
            }
        }
        if (buying != null) {
            finishBuy(owned || code == BillingClient.BillingResponseCode.ITEM_ALREADY_OWNED
                    ? answer(true, price(), "owned")
                    : pending ? answer(false, price(), "pending")
                    : code == BillingClient.BillingResponseCode.USER_CANCELED ? answer(false, price(), "cancelled")
                    : answer(false, price(), "error"));
        }
        if (owned) notifyListeners("licenseChanged", new JSObject());
    }
}
