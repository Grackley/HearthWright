export const readLocalSetting = (key: string) => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export const writeLocalSetting = (key: string, value?: string) => {
  try {
    if (value === undefined) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
