'use client';
import {useEffect} from 'react';
import {inquiryVisitor} from './inquiry-tracking';
export default function InquiryMetrics(){useEffect(()=>{if(/^\/(admin|admin-login|account|dashboard|client-reviews|reset-password)(\/|$)/.test(location.pathname))return;const visitorId=inquiryVisitor();if(visitorId&&document.referrer)fetch('/api/search-referrals',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId,referrer:document.referrer,landing:location.pathname+location.search}),keepalive:true}).catch(()=>{});if(visitorId)fetch('/api/inquiry-metrics',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({visitorId}),keepalive:true}).catch(()=>{});},[]);return null;}
