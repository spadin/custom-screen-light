const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

// iOS 27 asserts at launch unless the app adopts the scene-based life cycle. Expo ships
// ExpoAppSceneDelegate for this, but the SDK 57 prebuild template doesn't wire it up, so
// re-apply the wiring every time `expo prebuild` regenerates ios/.
//
// ---------------------------------------------------------------------------
// TEMPORARY: delete this plugin when upgrading to Expo SDK 58.
// ---------------------------------------------------------------------------
// Verified 2026-09-27:
//   - expo 57.0.25 / expo-template-bare-minimum 57.0.27 -> no scene wiring. Without this
//     plugin the app builds and installs but dies at launch on an iOS 27 device/simulator
//     with "UIScene life cycle is required for apps built with this SDK".
//   - expo-template-bare-minimum 58.0.7 -> ships the wiring already, in the same shape this
//     plugin produces: AppDelegate conforms to ExpoReactNativeFactoryProvider, the window
//     bootstrap moves out of the app delegate, and Info.plist points
//     UISceneDelegateClassName at $(PRODUCT_MODULE_NAME).SceneDelegate. The only difference
//     is that SDK 58 puts SceneDelegate in its own SceneDelegate.swift; this plugin declares
//     it at the bottom of AppDelegate.swift so it does not have to edit project.pbxproj.
//
// To remove: delete this file, drop './plugins/withUISceneLifecycle' from app.json's
// plugins array, run `npx expo prebuild --clean -p ios`, then confirm the generated
// ios/<App>/Info.plist still has UIApplicationSceneManifest and the generated AppDelegate
// still conforms to ExpoReactNativeFactoryProvider. If both hold, the platform now does
// this on its own and the plugin is redundant.
//
// Left in place on SDK 58 it degrades safely rather than duplicating anything: the
// AppDelegate mod short-circuits on the conformance check below, and the Info.plist mod
// rewrites the same values. It should still be deleted rather than left to rot.

const SCENE_DELEGATE = `
/// iOS 27 refuses to launch apps still using the legacy UIApplication life cycle.
/// ExpoAppSceneDelegate creates the window and starts React Native; AppDelegate keeps
/// ownership of the factory and hands it over via ExpoReactNativeFactoryProvider.
class SceneDelegate: ExpoAppSceneDelegate {}
`;

const CLASS_DECL = 'class AppDelegate: ExpoAppDelegate {';

// The scene delegate owns window creation and React Native startup now, so this block
// has to come out of the app delegate or the app boots two roots.
const WINDOW_BOOTSTRAP =
  /#if os\(iOS\) \|\| os\(tvOS\)\s*\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*\n\s*factory\.startReactNative\([\s\S]*?\)\s*\n#endif\n\n/;

const withSceneAppDelegate = (config) =>
  withAppDelegate(config, (cfg) => {
    let contents = cfg.modResults.contents;

    if (contents.includes('ExpoReactNativeFactoryProvider')) {
      return cfg;
    }
    if (!contents.includes(CLASS_DECL)) {
      throw new Error('withUISceneLifecycle: unexpected AppDelegate class declaration');
    }
    if (!WINDOW_BOOTSTRAP.test(contents)) {
      throw new Error('withUISceneLifecycle: could not find the AppDelegate window bootstrap');
    }

    contents = contents
      .replace(CLASS_DECL, 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
      .replace(WINDOW_BOOTSTRAP, '');

    cfg.modResults.contents = contents + SCENE_DELEGATE;
    return cfg;
  });

const withSceneManifest = (config) =>
  withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
          },
        ],
      },
    };
    return cfg;
  });

module.exports = (config) => withSceneManifest(withSceneAppDelegate(config));
