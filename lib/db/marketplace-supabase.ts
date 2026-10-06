import "server-only";
import type { Json } from "./database.generated";
import { getSupabaseClient } from "./supabase";
import type { JobAggregate } from "./repository";
import { ConflictError, DomainError } from "../domain/errors";
import type {
  BookingCommandResult, BookingMutationRequest, BookingRecord, MarketplaceActor,
  MarketplaceRepository, ProviderConversionContext,
} from "../domain/bookings";

const camel = <T>(value: unknown): T => {
  if (Array.isArray(value)) return value.map(item=>camel(item)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key,item])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),camel(item)])) as T;
  return value as T;
};

function bookingFromDatabase(value: unknown): BookingRecord {
  const raw=camel<Record<string,unknown>>(value);
  const normalized={...raw};
  for (const key of ["stateCode","lgaCode","broadArea","privateAddress","budgetMin","budgetMax","linkedJobId","holdExpiresAt"] as const) {
    if (normalized[key] === null) delete normalized[key];
  }
  if (normalized.budgetMin !== undefined) normalized.budgetMin=String(normalized.budgetMin);
  if (normalized.budgetMax !== undefined) normalized.budgetMax=String(normalized.budgetMax);
  return normalized as unknown as BookingRecord;
}

function bookingToDatabase(booking: BookingRecord): Json {
  return {
    id: booking.id, public_id: booking.publicId, customer_id: booking.customerId,
    provider_id: booking.providerId, provider_service_id: booking.providerServiceId,
    request_text: booking.requestText, requested_start: booking.requestedStart,
    requested_end: booking.requestedEnd, timezone: booking.timezone,
    duration_minutes: booking.durationMinutes, location_mode: booking.locationMode,
    state_code: booking.stateCode ?? null, lga_code: booking.lgaCode ?? null,
    broad_area: booking.broadArea ?? null, private_address: booking.privateAddress ?? null,
    budget_min: booking.budgetMin ?? null, budget_max: booking.budgetMax ?? null,
    currency: booking.currency, status: booking.status, version: booking.version,
    expires_at: booking.expiresAt, linked_job_id: booking.linkedJobId ?? null,
    hold_expires_at: booking.holdExpiresAt ?? null, created_at: booking.createdAt, updated_at: booking.updatedAt,
  };
}

function commandResult(value: unknown): BookingCommandResult {
  const result=camel<{booking:unknown;replayed:boolean}>(value);
  return { booking: bookingFromDatabase(result.booking), replayed: result.replayed };
}

async function rpc<T>(name: "tl_create_booking" | "tl_read_booking" | "tl_list_bookings" | "tl_transition_booking" | "tl_convert_booking" | "tl_expire_bookings", input: Record<string,unknown>): Promise<T> {
  const {data,error}=await getSupabaseClient().rpc(name,input as never);
  if (error?.code === "40001") throw new ConflictError();
  if (error) {
    if (/access|permission|selected provider/i.test(error.message)) throw new DomainError("You don't have access to this booking.");
    throw new DomainError(error.message || "The booking operation could not be completed.");
  }
  return data as T;
}

export class SupabaseMarketplaceRepository implements MarketplaceRepository {
  async getBooking(id: string, actor: MarketplaceActor) {
    const data=await rpc<unknown>("tl_read_booking",{p_booking_id:id,p_actor_id:actor.id,p_actor_type:actor.type});
    return data ? bookingFromDatabase(data) : null;
  }

  async listBookings(actor: MarketplaceActor) {
    const data=await rpc<unknown[]>("tl_list_bookings",{p_actor_id:actor.id,p_actor_type:actor.type});
    return (data ?? []).map(bookingFromDatabase);
  }

  async createBooking(record: BookingRecord, actor: MarketplaceActor, request: BookingMutationRequest, hash: string) {
    const data=await rpc<unknown>("tl_create_booking",{p_record:bookingToDatabase(record),p_actor_id:actor.id,p_request_id:request.id,p_command_hash:hash});
    return commandResult(data);
  }

  async transitionBooking(id: string, actor: MarketplaceActor, nextStatus: "DECLINED" | "CANCELLED", request: BookingMutationRequest, hash: string, occurredAt: string) {
    const data=await rpc<unknown>("tl_transition_booking",{
      p_booking_id:id,p_actor_id:actor.id,p_actor_type:actor.type,p_next_status:nextStatus,
      p_expected_version:request.expectedVersion,p_request_id:request.id,p_command_hash:hash,p_occurred_at:occurredAt,
    });
    return commandResult(data);
  }

  async getProviderConversionContext(booking: BookingRecord): Promise<ProviderConversionContext> {
    const client=getSupabaseClient();
    const [profileResult,serviceResult,jobsResult]=await Promise.all([
      client.from("profiles").select("city,state,country").eq("user_id",booking.providerId).maybeSingle(),
      client.from("provider_services").select("public_title,service_definition_id").eq("id",booking.providerServiceId).eq("provider_id",booking.providerId).maybeSingle(),
      client.from("jobs").select("id").eq("provider_id",booking.providerId),
    ]);
    if (profileResult.error || serviceResult.error || jobsResult.error || !profileResult.data || !serviceResult.data) throw new DomainError("Provider conversion context is unavailable.");
    const definitionResult=await client.from("service_definitions").select("category_id").eq("id",serviceResult.data.service_definition_id).maybeSingle();
    if (definitionResult.error || !definitionResult.data) throw new DomainError("Provider service definition is unavailable.");
    const categoryResult=await client.from("service_categories").select("name").eq("id",definitionResult.data.category_id).maybeSingle();
    if (categoryResult.error || !categoryResult.data) throw new DomainError("Provider service category is unavailable.");
    return {
      providerLocation:[profileResult.data.city,profileResult.data.state,profileResult.data.country].filter(Boolean).join(", "),
      priorTransactionCount:jobsResult.data?.length ?? 0,
      serviceTitle:serviceResult.data.public_title,
      categoryName:categoryResult.data.name,
    };
  }

  async convertBooking(id: string, actor: MarketplaceActor, request: BookingMutationRequest, hash: string, aggregate: JobAggregate, occurredAt: string) {
    const data=await rpc<unknown>("tl_convert_booking",{
      p_booking_id:id,p_provider_id:actor.id,p_expected_version:request.expectedVersion,
      p_request_id:request.id,p_command_hash:hash,p_job_record:aggregate as unknown as Json,p_occurred_at:occurredAt,
    });
    return commandResult(data);
  }

  expireBookings(now: string) { return rpc<number>("tl_expire_bookings",{p_now:now}); }
}

export const supabaseMarketplaceStore = new SupabaseMarketplaceRepository();
