import { supabase } from './cloud';

export type GatewayWorld = { day:number; weather:string; location:string; action:string };
export type GatewayResult = { text:string; companionId:string };

export async function realAI(companionId:string, message:string, world?:GatewayWorld):Promise<GatewayResult|null>{
  if(!supabase) return null;
  const {data,error} = await supabase.functions.invoke('companion-chat',{body:{companionId,message,world}});
  if(error) throw error;
  if(data?.error) throw new Error(data.error);
  return data as GatewayResult;
}
