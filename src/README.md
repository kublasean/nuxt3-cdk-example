## render-test npm package dir
Shared TypeScript code between repo components

### Using
To use in another module (a directory with a package.json):
1. Run `npm build` here
1. In the dir with a module's package.json run `npm i [relative path to src dir, where this readme is]`
```typescript
import * as domain from 'render-test'

// do stuff with shared domain logic 'domain'
```

### Testing
1. `npm build`
1. `node bin/[name of script]`, for example `node bin/set-lambda-env`

If the script needs to use AWS resources do `export AWS_CLI_PROFILE=[profile name]` first