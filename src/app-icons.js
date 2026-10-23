export const APP_ICON_THEMES = [
  { id: 'default', name: '默认线条图标', hint: '使用默认图标·白线条图标' },
  { id: 'ins-gray', name: 'ins灰白渐变', hint: '低饱和灰白渐变成套图标' },
]

const THEME_FOLDERS = {
  'ins-gray': 'app-icons/ins-gray',
}

export function appIconSrc(settings, id) {
  const theme = settings?.appIconTheme || 'default'
  if (theme.startsWith('custom-icon-')) {
    const customTheme = settings?.customIconThemes?.find((item) => item.id === theme)
    return customTheme?.icons?.[id] || settings?.customAppIcons?.[id] || ''
  }
  const custom = settings?.customAppIcons?.[id]
  if (custom) return custom
  const folder = THEME_FOLDERS[theme]
  if (!folder) return ''
  return `${import.meta.env.BASE_URL}${folder}/${id}.jpg`
}