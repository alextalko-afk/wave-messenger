// swift-tools-version: 5.9
import PackageDescription

// This local package is App.xcodeproj's only registered package product
// dependency; Xcode's SPM integration exposes everything it resolves
// (including transitive remote packages) to the App target's own search
// paths, so App/*.swift files can `import SocketIO` directly without any
// project.pbxproj changes. Originally wrapped Capacitor - repurposed here
// to bring in Socket.IO for the native rewrite instead.
let package = Package(
    name: "CapApp-SPM",
    platforms: [.iOS(.v16)],
    products: [
        .library(
            name: "CapApp-SPM",
            targets: ["CapApp-SPM"])
    ],
    dependencies: [
        .package(url: "https://github.com/socketio/socket.io-client-swift", .upToNextMinor(from: "16.1.1")),
        .package(url: "https://github.com/google/GoogleSignIn-iOS", from: "7.1.0")
    ],
    targets: [
        .target(
            name: "CapApp-SPM",
            dependencies: [
                .product(name: "SocketIO", package: "socket.io-client-swift"),
                .product(name: "GoogleSignIn", package: "GoogleSignIn-iOS")
            ]
        )
    ]
)
