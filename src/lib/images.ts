import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Opens the system photo picker. Returns a local URI, or null if cancelled. */
export async function pickImage(options: { square?: boolean } = {}): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: !!options.square,
    aspect: options.square ? [1, 1] : undefined,
    quality: 0.8,
  });
  return result.canceled ? null : result.assets[0].uri;
}

/**
 * Shrinks a photo to `width` px and returns its JPEG bytes, ready to upload.
 * Reads with expo-file-system: fetch() on a local file:// URI can "succeed" with an
 * error text body ("File not found"), which would then be uploaded as the photo.
 */
export async function prepareJpeg(localUri: string, width: number): Promise<ArrayBuffer> {
  const rendered = await ImageManipulator.manipulate(localUri).resize({ width }).renderAsync();
  const image = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
  const body = await new File(image.uri).arrayBuffer();
  if (!isJpeg(body)) throw new Error('Resized photo is not a valid JPEG');
  return body;
}

/** JPEG files start with FF D8 FF. */
export function isJpeg(data: ArrayBuffer): boolean {
  const head = new Uint8Array(data, 0, Math.min(3, data.byteLength));
  return head.length === 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
}
