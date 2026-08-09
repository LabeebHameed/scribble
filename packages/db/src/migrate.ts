import "dotenv/config"
import { runMigrations } from "./migrate-runner"

async function main() {
  await runMigrations()
  console.log("Migrations applied.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
