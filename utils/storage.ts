export function getData<T>(key: string, defaultValue: T): T {
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return defaultValue;
  }
}

export function setData<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeData(key: string): void {
  localStorage.removeItem(key);
}
