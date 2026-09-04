import UIKit
import Capacitor
import AVFoundation

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // THE RING/SILENT SWITCH WOULD OTHERWISE MUTE THE WHOLE GAME.
        //
        // WKWebView audio defaults to the `soloAmbient` session category, which
        // obeys the hardware mute switch. That is right for a page that might
        // autoplay a video at someone in a meeting; it is wrong for a game the
        // player deliberately opened, and it fails in the most confusing way
        // possible — everything works, nothing is audible, and no setting in
        // the game explains it. It is the single most reported "bug" for web
        // games shipped in a native iOS shell.
        //
        // `playback` says this audio is the point of the app. `.mixWithOthers`
        // is a deliberate courtesy: someone playing their own music keeps it,
        // and gets the game's sfx over the top, rather than having their
        // podcast killed by a puzzle game.
        //
        // An interruption (a call, Siri, an alarm) is NOT handled here. WebKit
        // parks the AudioContext in its own 'interrupted' state and the game
        // listens for that itself (10-audio.js, H-20) — pausing the run and
        // resuming on the next gesture. Native code has nothing to add.
        do {
            try AVAudioSession.sharedInstance().setCategory(
                .playback, mode: .default, options: [.mixWithOthers])
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // Not fatal: a failed session leaves iOS's default behaviour, which
            // is quiet-but-working. Never let audio setup stop the app booting.
            NSLog("[WarpVanguard] audio session unavailable: \(error.localizedDescription)")
        }
        return true
    }

    // NO LIFECYCLE, NO URL HANDLERS HERE. Under the UIScene lifecycle (Capacitor
    // 8.5) the app-level callbacks — applicationDidBecomeActive, open url,
    // continue userActivity — never fire; SceneDelegate carries them. And the
    // web layer already pauses a live run and suspends its AudioContext on
    // `visibilitychange`, which WKWebView fires on every scene transition.

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        let config = UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
        config.delegateClass = SceneDelegate.self
        return config
    }
}
