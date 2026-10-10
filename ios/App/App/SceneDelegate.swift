import UIKit
import Capacitor

/// Capacitor 8.5 runs the app on the UIScene lifecycle (Xcode 27 requires it).
/// The scene owns the window; URL opens and universal links arrive here now,
/// not on the AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    /// THE WINDOW IS NEVER TALLER THAN IT IS WIDE (2026-10-10). Built with the iOS
    /// 27 SDK, iPadOS resizes the scene whatever `UIRequiresFullScreen` says, and a
    /// window taller than wide makes the game paint sideways through its portrait
    /// transform. 1032 pt is the short side of the largest iPad (13-inch), and a
    /// window on an iPad's own screen is never taller than that screen's short
    /// side — so a window at least 1032 pt wide is never taller than it is wide.
    /// GameViewController's `prefersInterfaceOrientationLocked` is the other half.
    /// Apple calls the minimum a preference, not a rule: a tall external display
    /// under Stage Manager can still get past it.
    static let minimumWindowWidth: CGFloat = 1032

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // THE WINDOW IS ALREADY BUILT. Info.plist names Main.storyboard for this
        // scene, so UIKit has instantiated GameViewController and set `window`
        // before this call. The stock template creates a window here with a bare
        // bridge controller in it — that would silently replace the
        // game's controller and lose every override it carries (hidden home
        // indicator, deferred edge swipes, no bounce). Nothing is created here.
        if let sizes = (scene as? UIWindowScene)?.sizeRestrictions {
            sizes.minimumSize = CGSize(width: SceneDelegate.minimumWindowWidth, height: sizes.minimumSize.height)
        }
        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
