import UIKit
import Capacitor
import HealthKit

@objc(ZrizinHealthPlugin)
public class ZrizinHealthPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ZrizinHealthPlugin"
    public let jsName = "ZrizinHealth"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDailySnapshot", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        let metrics = call.getArray("metrics", String.self) ?? []

        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["granted": [], "denied": metrics])
            return
        }

        var readTypes = Set<HKObjectType>()
        var supportedMetrics: [String] = []
        var deniedMetrics: [String] = []

        for metric in metrics {
            switch metric {
            case "steps":
                if let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
                    readTypes.insert(stepType)
                    supportedMetrics.append(metric)
                } else {
                    deniedMetrics.append(metric)
                }
            case "workouts":
                readTypes.insert(HKObjectType.workoutType())
                supportedMetrics.append(metric)
            default:
                // Screen Time is intentionally not claimed as HealthKit data.
                deniedMetrics.append(metric)
            }
        }

        healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
            if let error = error {
                call.reject("HealthKit authorization failed", nil, error)
                return
            }

            if success {
                call.resolve(["granted": supportedMetrics, "denied": deniedMetrics])
            } else {
                call.resolve(["granted": [], "denied": metrics])
            }
        }
    }

    @objc func readDailySnapshot(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("HealthKit is not available on this device")
            return
        }

        guard let dateString = call.getString("date") else {
            call.reject("date is required")
            return
        }

        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"

        guard let date = formatter.date(from: dateString) else {
            call.reject("Invalid health snapshot date")
            return
        }

        let calendar = Calendar.current
        let start = calendar.startOfDay(for: date)
        guard let end = calendar.date(byAdding: .day, value: 1, to: start) else {
            call.reject("Could not calculate health snapshot day")
            return
        }

        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: .strictStartDate)
        let group = DispatchGroup()
        let lock = NSLock()
        var steps: Double?
        var workoutMinutes = 0.0
        var workouts: [[String: Any]] = []
        var queryError: Error?

        if let stepType = HKObjectType.quantityType(forIdentifier: .stepCount) {
            group.enter()
            let query = HKStatisticsQuery(
                quantityType: stepType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum
            ) { _, statistics, error in
                lock.lock()
                defer { lock.unlock(); group.leave() }
                if let error = error {
                    queryError = error
                    return
                }
                steps = statistics?.sumQuantity()?.doubleValue(for: HKUnit.count()) ?? 0
            }
            healthStore.execute(query)
        }

        group.enter()
        let workoutQuery = HKSampleQuery(
            sampleType: HKObjectType.workoutType(),
            predicate: predicate,
            limit: HKObjectQueryNoLimit,
            sortDescriptors: nil
        ) { _, samples, error in
            lock.lock()
            defer { lock.unlock(); group.leave() }
            if let error = error {
                queryError = error
                return
            }

            for workout in (samples as? [HKWorkout]) ?? [] {
                let minutes = workout.duration / 60.0
                workoutMinutes += minutes
                var item: [String: Any] = [
                    "id": workout.uuid.uuidString,
                    "activity": self.activityName(workout.workoutActivityType),
                    "startedAt": ISO8601DateFormatter().string(from: workout.startDate),
                    "endedAt": ISO8601DateFormatter().string(from: workout.endDate),
                    "durationMinutes": minutes
                ]
                if let distance = workout.totalDistance {
                    item["distanceMiles"] = distance.doubleValue(for: .mile())
                }
                workouts.append(item)
            }
        }
        healthStore.execute(workoutQuery)

        group.notify(queue: .main) {
            if let queryError = queryError {
                call.reject("Could not read HealthKit data", nil, queryError)
                return
            }

            var result: [String: Any] = [
                "date": dateString,
                "workoutMinutes": workoutMinutes,
                "workouts": workouts,
                "sources": ["apple_health"]
            ]
            if let steps = steps {
                result["steps"] = Int(steps.rounded())
            }
            call.resolve(result)
        }
    }

    private func activityName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking: return "Walking"
        case .running: return "Running"
        case .cycling: return "Cycling"
        case .swimming: return "Swimming"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Strength training"
        case .highIntensityIntervalTraining: return "HIIT"
        case .yoga: return "Yoga"
        case .hiking: return "Hiking"
        case .rowing: return "Rowing"
        case .elliptical: return "Elliptical"
        default: return "Workout"
        }
    }
}

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?
    private var healthPluginRegistered = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        DispatchQueue.main.async { [weak self] in
            self?.registerHealthPluginIfNeeded()
        }
        return true
    }

    private func registerHealthPluginIfNeeded() {
        guard !healthPluginRegistered,
              let bridgeViewController = window?.rootViewController as? CAPBridgeViewController,
              let bridge = bridgeViewController.bridge else { return }
        bridge.registerPluginInstance(ZrizinHealthPlugin())
        healthPluginRegistered = true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    func applicationWillResignActive(_ application: UIApplication) {
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        registerHealthPluginIfNeeded()
    }

    func applicationWillTerminate(_ application: UIApplication) {
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
}
