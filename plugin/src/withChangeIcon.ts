// referenced from https://github.com/expo/config-plugins/tree/master/packages/react-native-dynamic-app-icon

import {
  ConfigPlugin,
  IOSConfig,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  ExportedConfigWithProps,
} from '@expo/config-plugins';
import { generateImageAsync } from '@expo/image-utils';
import fs from 'fs';
import path from 'path';

// @ts-ignore
import pbxFile from 'xcode/lib/pbxFile';

const folderName = 'AppIcons';
const size = 60; // base icon size
const scales = [2, 3];

type IconSet = Record<string, { image: string }>;

type Props = {
  icons: Record<string, { image: string }>;
};

/**
 * If `scale` is provided, this will output the filename with '.png',
 * otherwise it outputs the filename without any extension.
 */
function getIconName(name: string, scale?: number) {
  return scale ? `${name}@${scale}x.png` : `${name}`;
}

async function iterateIconsAsync(
  { icons }: Props,
  callback: (
    key: string,
    icon: { image: string },
    index: number
  ) => Promise<void>
) {
  const entries = Object.entries(icons);
  for (let i = 0; i < entries.length; i++) {
    const [key, val] = entries[i];

    await callback(key, val, i);
  }
}

const withIconXcodeProject: ConfigPlugin<Props> = (config, { icons }) => {
  return withXcodeProject(config, async (config) => {
    const groupPath = `${config.modRequest.projectName!}/${folderName}`;
    const group = IOSConfig.XcodeUtils.ensureGroupRecursively(
      config.modResults,
      groupPath
    );
    const project = config.modResults;
    const opt: any = {};

    // Unlink old assets
    const groupId = Object.keys(project.hash.project.objects.PBXGroup).find(
      (id) => {
        const _group = project.hash.project.objects.PBXGroup[id];
        return _group.name === group.name;
      }
    );
    const variantGroupId = Object.keys(
      project.hash.project.objects.PBXVariantGroup
    ).find((id) => {
      const _group = project.hash.project.objects.PBXVariantGroup[id];
      return _group.name === group.name;
    });

    const children = [...(group.children || [])];

    for (const child of children) {
      const file = new pbxFile(path.join(group.name, child.comment), opt);
      file.target = opt ? opt.target : undefined;

      project.removeFromPbxBuildFileSection(file); // PBXBuildFile
      project.removeFromPbxFileReferenceSection(file); // PBXFileReference
      if (group) {
        if (groupId) {
          project.removeFromPbxGroup(file, groupId); //Group other than Resources (i.e. 'splash')
        } else if (variantGroupId) {
          project.removeFromPbxVariantGroup(file, variantGroupId); // PBXVariantGroup
        }
      }
      project.removeFromPbxResourcesBuildPhase(file); // PBXResourcesBuildPhase
    }

    // Link new assets
    await iterateIconsAsync({ icons }, async (key) => {
      for (const scale of scales) {
        const iconFileName = getIconName(key, scale);

        if (
          !group?.children.some(
            ({ comment }: { comment: string }) => comment === iconFileName
          )
        ) {
          // Only write the file if it doesn't already exist.
          config.modResults = IOSConfig.XcodeUtils.addResourceFileToGroup({
            filepath: path.join(groupPath, iconFileName),
            groupName: groupPath,
            project: config.modResults,
            isBuildFile: true,
            verbose: true,
          });
        } else {
          console.log('Skipping duplicate: ', iconFileName);
        }
      }
    });

    return config;
  });
};

const withIconInfoPlist: ConfigPlugin<Props> = (config, { icons }) => {
  return withInfoPlist(config, async (config) => {
    const altIcons: Record<
      string,
      { CFBundleIconFiles: string[]; UIPrerenderedIcon: boolean }
    > = {};

    await iterateIconsAsync({ icons }, async (key, icon) => {
      altIcons[key] = {
        CFBundleIconFiles: [
          // Must be a file path relative to the source root (not a icon set it seems).
          // i.e. `BlueIcon` when the image is `ios/AppName/AppIcons/BlueIcon@2x.png`
          getIconName(key),
        ],
        UIPrerenderedIcon: false,
      };
    });

    /**
     * @param {string}  key
     */
    function applyToPlist(key: string) {
      if (
        typeof config.modResults[key] !== 'object' ||
        Array.isArray(config.modResults[key]) ||
        !config.modResults[key]
      ) {
        config.modResults[key] = {};
      }

      // @ts-expect-error
      config.modResults[key].CFBundleAlternateIcons = altIcons;

      // @ts-expect-error
      config.modResults[key].CFBundlePrimaryIcon = altIcons.default;
    }

    // Apply for both tablet and phone support
    applyToPlist('CFBundleIcons');
    applyToPlist('CFBundleIcons~ipad');

    return config;
  });
};

async function createIconsAsync(
  config: ExportedConfigWithProps,
  { icons }: Props
) {
  const iosRoot = path.join(
    config.modRequest.platformProjectRoot,
    config.modRequest.projectName!
  );

  const iconsFolder = path.join(iosRoot, folderName);

  // Delete all existing assets
  try {
    await fs.promises.rm(iconsFolder, { recursive: true });
  } catch {
    // will error if the folder doesn't exist (don't need to do anything)
  }

  // Ensure directory exists
  await fs.promises.mkdir(iconsFolder, { recursive: true });

  // Generate new assets
  await iterateIconsAsync({ icons }, async (key, icon) => {
    for (const scale of scales) {
      const iconFileName = getIconName(key, scale);
      const fileName = path.join(folderName, iconFileName);
      const outputPath = path.join(iosRoot, fileName);

      const scaledSize = scale * size;
      const { source } = await generateImageAsync(
        {
          projectRoot: config.modRequest.projectRoot,
          cacheType: 'react-native-dynamic-app-icon',
        },
        {
          name: iconFileName,
          src: icon.image,
          removeTransparency: true,
          backgroundColor: '#ffffff',
          resizeMode: 'cover',
          width: scaledSize,
          height: scaledSize,
        }
      );

      await fs.promises.writeFile(outputPath, source);
    }
  });
}

const withIconImages: ConfigPlugin<Props> = (config, props) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      await createIconsAsync(config, props);
      return config;
    },
  ]);
};

const withChangeIcon: ConfigPlugin<IconSet | void> = (config, props = {}) => {
  let icons: Props['icons'] = props || {};

  // add `default` icon
  icons.default = {
    image: './assets/icon.png',
  };

  config = withIconXcodeProject(config, { icons });
  config = withIconInfoPlist(config, { icons });
  config = withIconImages(config, { icons });

  return config;
};

export default withChangeIcon;
