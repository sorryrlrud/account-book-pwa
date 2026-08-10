import { describe, expect, it } from 'vitest'
import { buildRange, buildRowRange, toRowNumber } from './sheets.ts'

describe('sheet utilities', () => {
  it('builds quoted A1 ranges', () => {
    expect(buildRange('8', 'A:Z')).toBe("'8'!A:Z")
    expect(buildRange('앱설정', 'A1:B6')).toBe("'앱설정'!A1:B6")
  })

  it('converts zero-based indexes to sheet row numbers', () => {
    expect(toRowNumber(0)).toBe(1)
    expect(toRowNumber(26)).toBe(27)
  })

  it('builds row ranges for metadata updates', () => {
    expect(buildRowRange('8', 27)).toBe("'8'!A27:Z27")
    expect(buildRowRange('8', 27, 'X:Z')).toBe("'8'!X27:Z27")
  })
})
