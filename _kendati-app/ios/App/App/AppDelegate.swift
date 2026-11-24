import UIKit
import Capacitor
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

// MARK: - KENDATI: layar penuh, mode Mobile/Web, menu mengambang, unduhan


/// Pembungkus agar WKUserContentController tidak menahan view controller (hindari kebocoran memori).
private final class KendatiWeakHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(c, didReceive: message)
    }
}

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private let modeKey = "kendatiMode"
    private let desktopUA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15 KendatiApp KendatiDesktop"

    // tanpa status bar & home indicator otomatis tersembunyi -> halaman bersih
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        guard let wv = webView else { return }
        wv.allowsBackForwardNavigationGestures = true      // geser dari tepi kiri = kembali
        view.backgroundColor = UIColor(red: 7/255, green: 27/255, blue: 58/255, alpha: 1)

        let ucc = wv.configuration.userContentController
        if let url = Bundle.main.url(forResource: "kendati-overlay", withExtension: "js", subdirectory: "public"),
           let js = try? String(contentsOf: url, encoding: .utf8) {
            // semua frame: perlu untuk unduhan dari iframe Apps Script; UI hanya tampil di frame utama
            ucc.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: false))
        }
        ucc.add(KendatiWeakHandler(self), name: "kendati")
        applyMode(reload: false)
    }

    private var isDesktop: Bool { UserDefaults.standard.string(forKey: modeKey) == "desktop" }

    private func applyMode(reload: Bool) {
        guard let wv = webView else { return }
        // nil = kembali ke UA bawaan (+ "KendatiApp" dari appendUserAgent)
        wv.customUserAgent = isDesktop ? desktopUA : nil
        if reload { wv.reload() }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let action = body["action"] as? String else { return }
        let value = body["value"] as? String ?? ""
        switch action {
        case "setMode":
            UserDefaults.standard.set(value == "desktop" ? "desktop" : "mobile", forKey: modeKey)
            applyMode(reload: true)
        case "hardReload":
            let types: Set<String> = [WKWebsiteDataTypeDiskCache, WKWebsiteDataTypeMemoryCache]
            WKWebsiteDataStore.default().removeData(ofTypes: types, modifiedSince: .distantPast) { [weak self] in
                self?.webView?.reloadFromOrigin()
            }
        case "openExternal":
            if let url = URL(string: value), ["http", "https"].contains(url.scheme?.lowercased() ?? "") {
                UIApplication.shared.open(url)
            }
        case "saveFile":
            saveFile(base64: value, name: body["name"] as? String ?? "unduhan")
        default:
            break
        }
    }

    /// Simpan file ke aplikasi Files (Di iPhone Saya > KENDATI), lalu tampilkan lembar Bagikan.
    private func saveFile(base64: String, name: String) {
        guard let data = Data(base64Encoded: base64, options: .ignoreUnknownCharacters) else { return }
        let safe = name.components(separatedBy: CharacterSet(charactersIn: "/\\:*?\"<>|")).joined(separator: "_")
        let docs = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
        let url = docs.appendingPathComponent(safe.isEmpty ? "unduhan" : safe)
        do {
            try data.write(to: url, options: .atomic)
        } catch {
            return
        }
        let sheet = UIActivityViewController(activityItems: [url], applicationActivities: nil)
        if let pop = sheet.popoverPresentationController {
            pop.sourceView = view
            pop.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 40, width: 1, height: 1)
        }
        present(sheet, animated: true)
    }
}
