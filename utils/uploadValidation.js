const { HttpError } = require("./security");
function validateFile(file, imagesOnly = false) {
  const b = file?.buffer;
  if (!Buffer.isBuffer(b) || !b.length || b.length > 5 * 1024 * 1024)
    throw new HttpError(400, "Upload a file smaller than 5 MB.");
  const png = b
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp =
    b.toString("ascii", 0, 4) === "RIFF" &&
    b.toString("ascii", 8, 12) === "WEBP";
  const pdf = b.toString("ascii", 0, 5) === "%PDF-";
  if (!(png || jpeg || webp || (!imagesOnly && pdf)))
    throw new HttpError(
      400,
      "Only valid JPEG, PNG, WebP images or PDF documents are accepted.",
    );
  return true;
}
module.exports = { validateFile };
