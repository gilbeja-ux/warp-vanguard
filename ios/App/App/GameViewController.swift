import UIKit
import Capacitor

/// The one view controller the app has. Capacitor's `CAPBridgeViewController`
/// hosts the WKWebView; this subclass adds what a full-screen landscape game
/// needs from UIKit that no config key can ask for.
///
/// Main.storyboard names this class, and SceneDelegate leaves the storyboard's
/// window alone so it stays the root. `cap add ios` would put the stock bridge
/// controller back — scripts/test.js pins the storyboard so that cannot pass
/// quietly.
///
/// NOT here, on purpose: the home indicator. Capacitor 8 ships a SystemBars
/// plugin that owns `prefersHomeIndicatorAutoHidden` (an extension on the base
/// class, not overridable), and `plugins.SystemBars.hidden: true` in
/// capacitor.config.json hides the status bar and the indicator together — on
/// Android too. The pinch is off the same way (`ios.zoomEnabled: false`).
class GameViewController: CAPBridgeViewController {

    /// The ring is drawn to the frame edges; a status bar over it is a crop.
    /// SystemBars hides it from config; this keeps it hidden through any
    /// presentation that asks the controller directly.
    override var prefersStatusBarHidden: Bool { true }

    /// Both thumbs live near the long edges in landscape. Deferring the top
    /// and bottom edges means a swipe that starts there shows the indicator
    /// first and only leaves the game on a second, deliberate swipe — the same
    /// courtesy every full-screen game on the platform asks for. Left and
    /// right are left alone: the back-swipe is disabled on the web view, so
    /// there is nothing to defer there.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { [.top, .bottom] }

    /// Restates Info.plist's landscape lock at the controller, so no future
    /// presentation from this controller can inherit a portrait mask.
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    override func viewDidLoad() {
        super.viewDidLoad()
        // capacitor.config.json turns scrolling, zoom and the content inset off;
        // the rubber-band bounce is the one gesture the config has no key for.
        webView?.scrollView.bounces = false
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
    }
}
