# Expo Installation

This package cannot be used in the "Expo Go" app because [it requires
custom native code](https://docs.expo.io/workflow/customizing/).
However, it can be used with
[`expo-dev-client`](https://docs.expo.dev/clients/getting-started/) as
outlined below.

> 🚨 Currently React Native Change Icon's config plugin for Expo has only been
> implemented for iOS. A pull request adding the necessary setup steps for Android would be welcome.

### Install the package

```sh
yarn add react-native-change-icon
```

### Add the config plugin

Then add the [config
plugin](https://docs.expo.io/guides/config-plugins/) details to the
[`plugins`](https://docs.expo.io/versions/latest/config/app/#plugins)
array of your `app.json` or `app.config.js`:

Include an object with your alternate icons. Use the icon name and the
location of a source image (at least 180 x 180px) to output into @2x and @3x variants.
The first icon in the list will be set as your primary icon.

```json
{
  "expo": {
    "plugins": [
      [
        "react-native-change-icon",
        {
          "primary": "./assets/icon.png",
          "white": "./assets/altIcons/white.png",
          "gold": "./assets/altIcons/gold.png",
          "red": "./assets/altIcons/red.png"
        }
      ]
    ]
  }
}
```

### Rebuild your app

Finally rebuild your app (this is further described in Expo's ["Adding custom native code"](https://docs.expo.io/workflow/customizing/) guide).

```
expo prebuild

expo run:ios
```
