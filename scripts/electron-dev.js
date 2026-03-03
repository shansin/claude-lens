const { spawn } = require('child_process')
const waitOn = require('wait-on')

async function main() {
  await waitOn({ resources: ['tcp:5173'], timeout: 30000 })
  console.log('[ELECTRON] Vite ready, starting Electron...')
  const args = process.platform === 'linux' ? ['--no-sandbox', '.'] : ['.']
  const child = spawn(
    require.resolve('electron/cli.js'),
    args,
    {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'development', VITE_DEV_SERVER_URL: 'http://localhost:5173' },
    }
  )
  child.on('close', () => process.exit())
}

main().catch(console.error)
