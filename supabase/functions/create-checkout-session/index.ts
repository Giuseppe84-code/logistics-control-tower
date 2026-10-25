import { userHandler } from '../_shared/handlers.ts'
import { appUrl, services } from '../_shared/runtime.ts'
Deno.serve(userHandler('checkout', services(), appUrl()))
