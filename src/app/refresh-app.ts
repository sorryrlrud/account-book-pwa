interface BuildVersionResponse {
  version: string
}

export async function getLatestBuildVersion(
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const versionUrl = new URL('version.json', window.location.origin + import.meta.env.BASE_URL)
  versionUrl.searchParams.set('t', Date.now().toString())

  const response = await fetcher(versionUrl, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error('최신 버전을 확인하지 못했습니다. 네트워크 연결을 확인해주세요.')
  }

  const result = (await response.json()) as Partial<BuildVersionResponse>
  if (!result.version) {
    throw new Error('최신 버전 정보를 확인하지 못했습니다.')
  }

  return result.version
}

export function createLatestVersionUrl(
  currentUrl: string,
  latestVersion: string,
): string {
  const url = new URL(currentUrl)
  url.searchParams.set('version', latestVersion)
  return url.toString()
}

export async function refreshToLatestVersion(): Promise<void> {
  const latestVersion = await getLatestBuildVersion()
  window.location.replace(createLatestVersionUrl(window.location.href, latestVersion))
}
