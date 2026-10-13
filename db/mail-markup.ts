export const escapeHtml=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export const accountUrl=(id:string)=>'https://lawvetter.kyle-george-1801.chatgpt.site/client-reviews?request='+encodeURIComponent(id);
export const adminUrl=(id:string,decision='')=>'https://lawvetter.kyle-george-1801.chatgpt.site/admin/client-reviews?request='+encodeURIComponent(id)+(decision?'&decision='+decision:'');
export const mailButton=(label:string,url:string)=>'<a href="'+escapeHtml(url)+'" style="display:inline-block;margin:8px 12px 8px 0;padding:12px 18px;background:#1769a8;color:#ffffff;text-decoration:none;border-radius:5px">'+escapeHtml(label)+'</a>';
