# Frigate Vision icon

`frigate-vision.png` is the approved full-resolution source: a violet eye with
wings on a light background, created with Imagegen during the project design
session. Preserve the artwork when generating the integration icon sizes.

From the project root, run:

```sh
npm ci
npm run build:brand
npm run check:brand
```

The generated files are `custom_components/frigate_vision/brand/icon.png`
(256 × 256) and `icon@2x.png` (512 × 512). Both include the selected light
background and opaque white outer margin.

The build also exports matching `logo.png` and `logo@2x.png` files for Home
Assistant, the documentation logo and favicon, and a 1280 × 640 GitHub social
preview at `assets/brand/social-preview.png`.
