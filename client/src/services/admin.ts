export type Row = Record<string, any>;
export async function adminRequest<T = Row>(path: string, body?: unknown, method = 'GET'): Promise<T> {
  const res = await fetch(`/api/admin/${path}`, { method, headers: { Authorization: `Bearer ${localStorage.getItem('shadi_token') || ''}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : {body: JSON.stringify(body)}) });
  const value = await res.json();
  if(!res.ok) throw new Error(value.message || 'The request could not be completed');
  return value;
}
export async function exportAdmin(kind: string, query: string) {
  const res=await fetch(`/api/admin/export/${kind}?${query}`,{headers:{Authorization:`Bearer ${localStorage.getItem('shadi_token')||''}`}});
  if(!res.ok) throw new Error((await res.json()).message||'Export failed');
  const url=URL.createObjectURL(await res.blob());const a=document.createElement('a');a.href=url;a.download=`shadiplanner-${kind}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
