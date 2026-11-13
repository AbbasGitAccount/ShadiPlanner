import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const mobileRoot = path.resolve(__dirname, '..');

function patchFile(relPath, replacers) {
  const fullPath = path.join(mobileRoot, relPath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`[patch-cmake] Skipping non-existent file: ${relPath}`);
    return;
  }
  let content = fs.readFileSync(fullPath, 'utf8');
  let changed = false;

  for (const { search, replace } of replacers) {
    if (content.includes(replace)) continue;
    if (typeof search === 'string') {
      if (content.includes(search)) {
        content = content.replace(search, replace);
        changed = true;
      }
    } else if (search instanceof RegExp) {
      if (search.test(content)) {
        content = content.replace(search, replace);
        changed = true;
      }
    }
  }

  if (changed) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`[patch-cmake] Patched ${relPath}`);
  } else {
    console.log(`[patch-cmake] Up-to-date: ${relPath}`);
  }
}

function copyFiles(srcDir, destDir) {
  const fullSrc = path.join(mobileRoot, srcDir);
  const fullDest = path.join(mobileRoot, destDir);
  if (!fs.existsSync(fullSrc)) return;
  if (!fs.existsSync(fullDest)) fs.mkdirSync(fullDest, { recursive: true });
  for (const file of fs.readdirSync(fullSrc)) {
    const srcFile = path.join(fullSrc, file);
    const destFile = path.join(fullDest, file);
    if (fs.statSync(srcFile).isFile()) {
      fs.copyFileSync(srcFile, destFile);
    }
  }
}

// 1. react-native-screens
patchFile('node_modules/react-native-screens/android/CMakeLists.txt', [
  {
    search: 'PROPERTIES\n  OUTPUT_NAME rnscreens',
    replace: 'PROPERTIES\n  LINKER_LANGUAGE CXX\n  OUTPUT_NAME rnscreens',
  },
  {
    search: 'target_link_libraries(rnscreens\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(rnscreens\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

patchFile('node_modules/react-native-screens/android/src/main/jni/CMakeLists.txt', [
  {
    search: 'file(GLOB LIB_CUSTOM_SRCS CONFIGURE_DEPENDS *.cpp ${LIB_COMMON_COMPONENTS_DIR}/*.cpp ${LIB_COMMON_COMPONENTS_DIR}/utils/*.cpp)\nfile(GLOB LIB_CODEGEN_SRCS CONFIGURE_DEPENDS ${LIB_ANDROID_GENERATED_COMPONENTS_DIR}/*.cpp)',
    replace: 'file(COPY ${LIB_COMMON_COMPONENTS_DIR}/ DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src_common FILES_MATCHING PATTERN "*.cpp" PATTERN "*.h")\nfile(COPY ${LIB_ANDROID_GENERATED_COMPONENTS_DIR}/ DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src_codegen FILES_MATCHING PATTERN "*.cpp" PATTERN "*.h")\n\nfile(GLOB_RECURSE LIB_CUSTOM_SRCS CONFIGURE_DEPENDS *.cpp ./src_common/*.cpp)\nfile(GLOB_RECURSE LIB_CODEGEN_SRCS CONFIGURE_DEPENDS ./src_codegen/*.cpp)',
  },
  {
    search: 'target_include_directories(\n  ${LIB_TARGET_NAME}\n  PUBLIC\n  .',
    replace: 'target_include_directories(\n  ${LIB_TARGET_NAME}\n  PUBLIC\n  .\n  ${CMAKE_CURRENT_SOURCE_DIR}/src_common\n  ${CMAKE_CURRENT_SOURCE_DIR}/src_codegen',
  },
  {
    search: 'target_link_libraries(\n  ${LIB_TARGET_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(\n  ${LIB_TARGET_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

// 2. react-native-worklets
patchFile('node_modules/react-native-worklets/android/CMakeLists.txt', [
  {
    search: 'target_link_libraries(worklets\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(worklets\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

// 3. react-native-reanimated
patchFile('node_modules/react-native-reanimated/android/CMakeLists.txt', [
  {
    search: 'target_link_libraries(reanimated\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(reanimated\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

patchFile('node_modules/react-native-reanimated/Common/NativeView/CMakeLists.txt', [
  {
    search: 'file(\n  GLOB CODEGEN_ORIGINAL_SRCS CONFIGURE_DEPENDS\n  ${CODEGEN_JNI_DIR}/*.cpp\n  ${CODEGEN_COMPONENTS_DIR}/*.cpp\n)',
    replace: 'file(COPY ${CODEGEN_JNI_DIR}/ DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src_codegen FILES_MATCHING PATTERN "*.cpp")\n\nfile(\n  GLOB CODEGEN_ORIGINAL_SRCS CONFIGURE_DEPENDS\n  ./src_codegen/*.cpp\n  ./src_codegen/react/renderer/components/rnreanimated/*.cpp\n)',
  },
  {
    search: 'target_link_libraries(\n  react_codegen_rnreanimated\n  fbjni\n  jsi\n  reactnative\n)',
    replace: 'target_link_libraries(\n  react_codegen_rnreanimated\n  fbjni\n  jsi\n  reactnative\n  c++_shared\n)',
  },
]);

// 4. react-native-gesture-handler
copyFiles(
  'node_modules/react-native-gesture-handler/shared/shadowNodes/react/renderer/components/rngesturehandler_codegen',
  'node_modules/react-native-gesture-handler/android'
);

patchFile('node_modules/react-native-gesture-handler/android/CMakeLists.txt', [
  {
    search: 'file(GLOB_RECURSE rn_gesture_handler_SRCS CONFIGURE_DEPENDS ../shared/shadowNodes/*.cpp)',
    replace: 'file(GLOB rn_gesture_handler_SRCS CONFIGURE_DEPENDS ./RNGestureHandlerDetectorShadowNode.cpp)',
  },
  {
    search: 'target_include_directories(react_codegen_rngesturehandler_codegen PUBLIC ../shared/shadowNodes)',
    replace: 'target_include_directories(react_codegen_rngesturehandler_codegen PUBLIC .)\ntarget_include_directories(react_codegen_rngesturehandler_codegen PUBLIC ../shared/shadowNodes)\ntarget_include_directories(react_codegen_rngesturehandler_codegen PUBLIC ../shared/shadowNodes/react/renderer/components/rngesturehandler_codegen)',
  },
  {
    search: 'target_link_libraries(\n  react_codegen_rngesturehandler_codegen\n  fbjni\n  jsi\n  reactnative\n)',
    replace: 'target_link_libraries(\n  react_codegen_rngesturehandler_codegen\n  fbjni\n  jsi\n  reactnative\n  c++_shared\n)',
  },
]);

patchFile('node_modules/react-native-gesture-handler/android/src/main/jni/CMakeLists.txt', [
  {
    search: 'target_link_libraries(\n  ${PACKAGE_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(\n  ${PACKAGE_NAME}\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

// 5. react-native-safe-area-context
patchFile('node_modules/react-native-safe-area-context/android/src/main/jni/CMakeLists.txt', [
  {
    search: 'file(GLOB LIB_CUSTOM_SRCS CONFIGURE_DEPENDS *.cpp ${LIB_COMMON_DIR}/react/renderer/components/${LIB_LITERAL}/*.cpp)\nfile(GLOB LIB_CODEGEN_SRCS CONFIGURE_DEPENDS ${LIB_ANDROID_GENERATED_JNI_DIR}/*.cpp ${LIB_ANDROID_GENERATED_COMPONENTS_DIR}/*.cpp)',
    replace: 'file(COPY ${LIB_COMMON_DIR}/react/renderer/components/${LIB_LITERAL}/ DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src_common FILES_MATCHING PATTERN "*.cpp" PATTERN "*.h")\nfile(COPY ${LIB_ANDROID_GENERATED_JNI_DIR}/ DESTINATION ${CMAKE_CURRENT_SOURCE_DIR}/src_codegen FILES_MATCHING PATTERN "*.cpp" PATTERN "*.h")\n\nfile(GLOB_RECURSE LIB_CUSTOM_SRCS CONFIGURE_DEPENDS *.cpp ./src_common/*.cpp)\nfile(GLOB_RECURSE LIB_CODEGEN_SRCS CONFIGURE_DEPENDS ./src_codegen/*.cpp)',
  },
  {
    search: 'target_include_directories(\n  ${LIB_TARGET_NAME}\n  PUBLIC\n  .',
    replace: 'target_include_directories(\n  ${LIB_TARGET_NAME}\n  PUBLIC\n  .\n  ${CMAKE_CURRENT_SOURCE_DIR}/src_common\n  ${CMAKE_CURRENT_SOURCE_DIR}/src_codegen',
  },
  {
    search: 'target_link_libraries(\n          ${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          reactnative\n  )',
    replace: 'target_link_libraries(\n          ${LIB_TARGET_NAME}\n          fbjni\n          jsi\n          reactnative\n          c++_shared\n  )',
  },
]);

// 6. expo-modules-core
patchFile('node_modules/expo-modules-core/android/cmake/common.cmake', [
  {
    search: 'target_link_libraries(EXPO_COMMON INTERFACE\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n)',
    replace: 'target_link_libraries(EXPO_COMMON INTERFACE\n  ReactAndroid::reactnative\n  ReactAndroid::jsi\n  fbjni::fbjni\n  c++_shared\n)',
  },
]);

patchFile('node_modules/expo-modules-core/android/cmake/modulesV2.cmake', [
  {
    search: 'target_link_libraries(expo-modules-v2 PRIVATE c++_shared)',
    replace: 'target_link_libraries(expo-modules-v2 PRIVATE c++_shared)',
  },
]);

console.log('[patch-cmake] All CMake patches applied successfully.');
