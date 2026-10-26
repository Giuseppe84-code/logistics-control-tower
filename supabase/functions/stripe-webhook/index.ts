import { webhookHandler } from '../_shared/handlers.ts'
import { services } from '../_shared/runtime.ts'
Deno.serve(webhookHandler(services()))
