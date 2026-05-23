# libsonare Homepage

Homepage for [libsonare](https://sonare.libraz.net) - built with VitePress.

The site hosts both the browser audio analysis demo and the local-only
mastering demo at `/mastering`.

## Development

```bash
# Install dependencies
yarn install

# Start dev server
yarn dev

# Build for production
yarn build

# Validate built route artifacts after a production build
yarn check:built-routes

# Preview production build
yarn preview

# Copy WASM from ../libsonare/bindings/wasm/dist
yarn copy:wasm

# Run all docs, i18n, mastering docs, and preset validation checks
yarn check

# Run the full pre-release gate, including production build and built-route checks
yarn verify

# Run individual gates when narrowing a failure
yarn check:docs
yarn check:glossary
yarn check:i18n
yarn check:mastering-docs
yarn check:built-routes
yarn check:mastering
```

## License

Apache-2.0 - see the [LICENSE](LICENSE) file for details.
