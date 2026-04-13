module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel', // 윈도우 설치 파일 (.exe)
      config: {
        name: 'transparent_paint',
      },
    },
    {
      name: '@electron-forge/maker-zip', // 압축 파일 (.zip)
      platforms: ['win32'],
    },
  ],
};