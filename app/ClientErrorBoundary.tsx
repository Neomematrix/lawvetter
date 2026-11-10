'use client';
import {Component,type ReactNode} from 'react';

export default class ClientErrorBoundary extends Component<{children:ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 componentDidCatch(error:Error){console.error('LawVetter client rendering failed',error);}
 render(){
  if(!this.state.failed)return this.props.children;
  return <main style={{minHeight:'100vh',padding:'48px 24px',background:'#f5f4ef',color:'#173d5d',fontFamily:'Arial,sans-serif'}}>
   <div style={{maxWidth:520,margin:'auto',padding:28,background:'#fff',borderRadius:16}}>
    <img src="/brand/lawvetter-logo.svg" alt="LawVetter" style={{width:220,maxWidth:'100%',marginBottom:24}}/>
    <h1 style={{fontSize:26}}>Let’s reload this page.</h1>
    <p style={{lineHeight:1.6}}>Something interrupted loading. Please try again.</p>
    <button onClick={()=>{const url=new URL(window.location.href);url.searchParams.set('_lv_reload',String(Date.now()));window.location.replace(url.href);}} style={{padding:'14px 22px',border:0,borderRadius:8,background:'#fe710c',color:'#fff',fontSize:16,fontWeight:700,cursor:'pointer'}}>Reload page</button>
    <p><a href="/discover" style={{color:'#165d96'}}>Find an attorney</a></p>
   </div>
  </main>;
 }
}
