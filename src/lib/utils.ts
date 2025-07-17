
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getUserInitials(name?: string | null): string {
  console.log('[ClaveCRM Debug] getUserInitials - Input name:', name);

  if (!name || typeof name !== 'string') {
    console.warn('[ClaveCRM Debug] getUserInitials: Name is invalid (null, undefined, or not a string). Returning "?". Input was:', name);
    return "?";
  }
  const trimmedName = name.trim();
  if (trimmedName === "") {
    console.warn('[ClaveCRM Debug] getUserInitials: Trimmed name is empty. Returning "?". Original input was:', name);
    return "?";
  }

  const nameParts = trimmedName.split(/\s+/).filter(part => part.length > 0);
  console.log('[ClaveCRM Debug] getUserInitials - Name parts for "' + trimmedName + '":', nameParts);

  if (nameParts.length === 0) {
    console.warn('[ClaveCRM Debug] getUserInitials: No valid name parts found after splitting. Returning "?". Original input was:', name);
    return "?";
  }

  let initials = "";
  if (nameParts.length === 1) {
    // For a single name part, take the first two letters if available, otherwise one.
    if (nameParts[0].length >= 2) {
      initials = nameParts[0].substring(0, 2).toUpperCase();
    } else {
      initials = nameParts[0].substring(0, 1).toUpperCase();
    }
  } else {
    // For multiple name parts, take the first letter of the first part
    // and the first letter of the last part.
    const firstInitial = nameParts[0][0] || '';
    const lastInitial = nameParts[nameParts.length - 1][0] || '';
    initials = `${firstInitial}${lastInitial}`.toUpperCase();
  }

  const finalInitials = initials || "?";
  console.log(`[ClaveCRM Debug] getUserInitials - For name "${trimmedName}", generated initials: "${finalInitials}"`);
  return finalInitials;
}


export function generateInitialsAvatar(initials: string, color: string): string {
  const canvas = document.createElement('canvas');
  const size = 128; // Output size of the avatar
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');

  if (context) {
    // Background color
    context.fillStyle = color;
    context.fillRect(0, 0, size, size);

    // Text properties
    context.fillStyle = '#FFFFFF'; // White text
    context.font = `bold ${size / 2.5}px Arial`; // Adjust font size relative to avatar size
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    // Draw text
    context.fillText(initials.toUpperCase(), size / 2, size / 2);
  }
  return canvas.toDataURL('image/png');
}

export function getRandomColor(): string {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  // Ensure a minimum brightness for better text visibility (optional)
  // This is a simple check, more sophisticated ones exist
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 180) { // If too light, try again (recursive, be careful with max depth)
    // return getRandomColor(); // Potentially recursive, could be an issue
  }
  return color;
}

export function dataUriToBlob(dataURI: string): Blob {
  // convert base64 to raw binary data held in a string
  // doesn't handle URLEncoded DataURIs - see SO answer #6850276 for code that does this
  const byteString = atob(dataURI.split(',')[1]);

  // separate out the mime component
  const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];

  // write the bytes of the string to an ArrayBuffer
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeString });
}
