import UIKit
import Capacitor

/// Capacitor 8.5 runs the app on the UIScene lifecycle (Xcode 27 requires it).
/// The scene owns the window; URL opens and universal links arrive here now,
/// not on the AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // THE WINDOW IS ALREADY BUILT. Info.plist names Main.storyboard for this
        // scene, so UIKit has instantiated GameViewController and set `window`
        // before this call. The stock template creates a window here with a bare
        // bridge controller in it — that would silently replace the
        // game's controller and lose every override it carries (hidden home
        // indicator, deferred edge swipes, no bounce). Nothing is created here.
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
