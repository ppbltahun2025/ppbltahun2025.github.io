import UIKit
import Capacitor
import WebKit
import AVFoundation
import Photos
import CoreLocation
import Security

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

/// Semua link http/https dimuat di dalam aplikasi (tidak dilempar ke Safari).
class KendatiNavPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "KendatiNavPlugin"
    let jsName = "KendatiNav"
    let pluginMethods: [CAPPluginMethod] = []

    override func shouldOverrideLoad(_ navigationAction: WKNavigationAction) -> NSNumber? {
        guard let url = navigationAction.request.url, let scheme = url.scheme?.lowercased() else { return nil }
        // file buatan halaman (blob:/data:) -> minta halaman mengirim isinya untuk disimpan
        if scheme == "blob" || scheme == "data" {
            if let data = try? JSONSerialization.data(withJSONObject: [url.absoluteString]),
               let arr = String(data: data, encoding: .utf8) {
                let js = "window.__kendatiGrabBlob && window.__kendatiGrabBlob(\(arr)[0], 'unduhan')"
                DispatchQueue.main.async { [weak self] in
                    self?.bridge?.webView?.evaluateJavaScript(js, completionHandler: nil)
                }
            }
            return NSNumber(value: true)
        }
        guard scheme == "http" || scheme == "https" else {
            return nil      // tel:, mailto:, whatsapp: -> aplikasi terkait
        }
        // iframe di dalam halaman biarkan apa adanya
        if let frame = navigationAction.targetFrame, !frame.isMainFrame { return nil }
        return NSNumber(value: false)        // semua halaman web dimuat di dalam aplikasi
    }
}

/// Jendela baru (target="_blank" / window.open) dimuat di WebView yang sama, bukan Safari.
/// Metode lain (alert, confirm, dll.) diteruskan ke penangan bawaan Capacitor.
private final class KendatiUIDelegate: NSObject, WKUIDelegate {
    weak var inner: WKUIDelegate?
    init(inner: WKUIDelegate?) { self.inner = inner }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            webView.load(URLRequest(url: url))
        }
        return nil
    }

    // Kamera/mikrofon untuk halaman: izin sistem sudah diminta aplikasi, jadi tidak ditanya ulang tiap halaman
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    override func responds(to aSelector: Selector!) -> Bool {
        return super.responds(to: aSelector) || (inner?.responds(to: aSelector) ?? false)
    }

    override func forwardingTarget(for aSelector: Selector!) -> Any? {
        if let inner = inner, inner.responds(to: aSelector) { return inner }
        return super.forwardingTarget(for: aSelector)
    }
}

class MainViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private var uiDelegateProxy: KendatiUIDelegate?

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
        bridge?.registerPluginInstance(KendatiNavPlugin())
        let proxy = KendatiUIDelegate(inner: wv.uiDelegate)
        uiDelegateProxy = proxy
        wv.uiDelegate = proxy
        applyMode(reload: false)
    }

    // MARK: Izin lokasi, kamera & galeri (ditanya sekali saat pertama dibuka)
    private let locationManager = CLLocationManager()

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        let key = "kendatiPermsAsked"
        guard !UserDefaults.standard.bool(forKey: key) else { return }
        UserDefaults.standard.set(true, forKey: key)
        // berurutan supaya dialog izin tidak bertumpuk
        AVCaptureDevice.requestAccess(for: .video) { _ in
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { _ in
                DispatchQueue.main.async { [weak self] in
                    self?.locationManager.requestWhenInUseAuthorization()
                }
            }
        }
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
        case "download":
            downloadURL(value, name: body["name"] as? String ?? "")
        case "login":
            handleLogin(message: message, json: value)
        case "postJson":
            postJson(urlString: body["url"] as? String ?? "", key: body["key"] as? String ?? "", json: value)
        default:
            break
        }
    }

    // MARK: Ingat login (nama & sandi di Keychain, per situs)
    private let loginService = "com.ciptakaryagresik.kendati.login"

    private func handleLogin(message: WKScriptMessage, json: String) {
        let origin = message.frameInfo.securityOrigin
        guard origin.protocol == "https", !origin.host.isEmpty,
              let data = json.data(using: .utf8),
              let msg = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = msg["type"] as? String else { return }
        let account = origin.host
        if type == "save" {
            let acc: [String: String] = ["u": msg["u"] as? String ?? "", "p": msg["p"] as? String ?? ""]
            guard let blob = try? JSONSerialization.data(withJSONObject: acc) else { return }
            let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                        kSecAttrService as String: loginService,
                                        kSecAttrAccount as String: account]
            SecItemDelete(query as CFDictionary)
            var add = query
            add[kSecValueData as String] = blob
            add[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
            SecItemAdd(add as CFDictionary, nil)
        } else if type == "get" {
            let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
                                        kSecAttrService as String: loginService,
                                        kSecAttrAccount as String: account,
                                        kSecReturnData as String: true,
                                        kSecMatchLimit as String: kSecMatchLimitOne]
            var out: CFTypeRef?
            var reply = ""
            if SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess,
               let d = out as? Data, let str = String(data: d, encoding: .utf8) {
                reply = str
            }
            guard let lit = try? JSONSerialization.data(withJSONObject: [reply]),
                  let arr = String(data: lit, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.__kendatiLoginReply && window.__kendatiLoginReply(\(arr)[0])",
                                        in: message.frameInfo, in: .page, completionHandler: nil)
        }
    }

    // MARK: Kirim rating ke Supabase dari aplikasi (tidak terhalang CSP halaman)
    private func postJson(urlString: String, key: String, json: String) {
        guard let url = URL(string: urlString), url.scheme == "https",
              url.host?.hasSuffix(".supabase.co") == true else { return }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue(key, forHTTPHeaderField: "apikey")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = json.data(using: .utf8)
        URLSession.shared.dataTask(with: req) { [weak self] _, response, _ in
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            DispatchQueue.main.async {
                self?.webView?.evaluateJavaScript("window.__kendatiRatingDone && window.__kendatiRatingDone(\(status))", completionHandler: nil)
            }
        }.resume()
    }

    // MARK: Unduh alamat http(s) memakai cookie halaman, lalu simpan seperti file lain
    private func downloadURL(_ string: String, name: String) {
        guard let url = URL(string: string) else { return }
        WKWebsiteDataStore.default().httpCookieStore.getAllCookies { [weak self] cookies in
            var req = URLRequest(url: url)
            let matching = cookies.filter { url.host?.hasSuffix($0.domain.trimmingCharacters(in: CharacterSet(charactersIn: "."))) ?? false }
            for (k, v) in HTTPCookie.requestHeaderFields(with: matching) { req.setValue(v, forHTTPHeaderField: k) }
            URLSession.shared.dataTask(with: req) { data, response, _ in
                guard let data = data else { return }
                var file = name
                if file.isEmpty { file = response?.suggestedFilename ?? url.lastPathComponent }
                DispatchQueue.main.async {
                    self?.saveFile(base64: data.base64EncodedString(), name: file.isEmpty ? "unduhan" : file)
                }
            }.resume()
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
