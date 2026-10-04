import { isJpeg } from '@/lib/images';

const bytes = (...values: number[]) => new Uint8Array(values).buffer;

describe('isJpeg', () => {
  it('accepts JPEG data', () => {
    expect(isJpeg(bytes(0xff, 0xd8, 0xff, 0xe0, 0x00))).toBe(true);
  });

  it('rejects an error message read instead of the photo', () => {
    expect(isJpeg(new TextEncoder().encode('File not found').buffer)).toBe(false);
  });

  it('rejects empty data', () => {
    expect(isJpeg(new ArrayBuffer(0))).toBe(false);
  });
});
