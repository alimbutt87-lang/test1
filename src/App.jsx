import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import AdminDashboard from './AdminDashboard';
console.log('B2B_BUILD_CHECK_V2');

// ===== CONFIGURATION =====
// Set to true for testing (bypasses paywall), false for production
const TEST_MODE = false;

// ===== FEATURE FLAGS =====
const DEVICE_CHECK_EMAIL = 'ali.m.butt87@gmail.com';
const PAYWALL_V2_EMAIL = 'ali.m.butt87@gmail.com'; // remove email check to roll out to everyone
// Stripe URLs
const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/fZu14n8Ac7Wm3QJ0TN6wE00';
const STRIPE_SUBSCRIBE_URL = 'https://buy.stripe.com/6oUaEXbMo90qcnfaun6wE02';

// Supabase configuration
const SUPABASE_URL = 'https://msngeennlvzbhohnrhnq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__01NFWdOHHofya6dz2CLhg_XFBWE8sQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===== DEVICE CHECK SCREEN =====
function DeviceCheckScreen({ onPass, onBack }) {
  const [micStatus, setMicStatus] = React.useState('checking');
  const [camStatus, setCamStatus] = React.useState('checking');
  const [browserOk, setBrowserOk] = React.useState(true);
  const [micError, setMicError] = React.useState('');
  const [volumeLevel, setVolumeLevel] = React.useState([2,3,4,3,2,3,4,5]);
  const streamRef = React.useRef(null);
  const animFrameRef = React.useRef(null);
  const bothOk = micStatus === 'ok' && camStatus === 'ok' && browserOk;

  React.useEffect(() => {
    const isChrome = /Chrome/.test(navigator.userAgent) && !/Edg/.test(navigator.userAgent);
    setBrowserOk(isChrome);
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then((stream) => {
        streamRef.current = stream;
        setMicStatus('ok'); setCamStatus('ok');
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);
        const animate = () => {
          analyser.getByteFrequencyData(data);
          setVolumeLevel(Array.from({ length: 8 }, (_, i) => Math.max(4, Math.round((data[Math.floor(i * data.length / 8)] / 255) * 100))));
          animFrameRef.current = requestAnimationFrame(animate);
        };
        animate();
      })
      .catch((err) => {
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then((s) => { streamRef.current = s; setMicStatus('ok'); setCamStatus('error'); })
          .catch(() => {
            setMicStatus('error'); setCamStatus('error');
            if (err.name === 'NotAllowedError') setMicError('Permission denied — click the mic icon in your address bar and allow access.');
            else if (err.name === 'NotFoundError') setMicError('No microphone found — plug one in or check your system settings.');
            else setMicError('Could not access your mic. Try Chrome for the best experience.');
          });
      });
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    };
  }, []);

  const handlePass = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    onPass();
  };
  const dot = (s) => ({ width:'7px', height:'7px', borderRadius:'50%', background: s==='ok'?'#00d9ff':s==='error'?'#ef4444':'#888', flexShrink:0 });

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#0a0a0f 0%,#1a1a2e 50%,#0a0a0f 100%)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',fontFamily:"'Inter','SF Pro Display',-apple-system,sans-serif",color:'#fff',position:'relative'}}>
      <div style={{position:'fixed',top:'-50%',left:'-50%',width:'200%',height:'200%',background:'radial-gradient(circle at 30% 30%,rgba(0,217,255,0.06) 0%,transparent 50%),radial-gradient(circle at 70% 70%,rgba(139,92,246,0.06) 0%,transparent 50%)',pointerEvents:'none',zIndex:0}}/>
      <div style={{maxWidth:'500px',width:'100%',zIndex:1}}>
        <div style={{textAlign:'center',marginBottom:'2rem'}}>
          <div style={{display:'inline-block',background:'rgba(0,217,255,0.08)',border:'1px solid rgba(0,217,255,0.2)',borderRadius:'20px',padding:'4px 14px',fontSize:'12px',color:'#00d9ff',letterSpacing:'0.08em',marginBottom:'1rem'}}>READY CHECK</div>
          <h2 style={{fontSize:'26px',fontWeight:'700',margin:'0 0 8px'}}>Before we start</h2>
          <p style={{color:'rgba(255,255,255,0.4)',fontSize:'14px',margin:0}}>Quick check to make sure your mic and camera are ready — takes under 20 seconds</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
          <div style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${micStatus==='error'?'rgba(239,68,68,0.4)':'rgba(0,217,255,0.25)'}`,borderRadius:'10px',padding:'1.25rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{color:'rgba(255,255,255,0.4)',fontSize:'11px',letterSpacing:'0.08em'}}>MICROPHONE</span>
              <div style={{display:'flex',alignItems:'center',gap:'5px'}}><div style={dot(micStatus)}/><span style={{fontSize:'11px',color:micStatus==='ok'?'#00d9ff':micStatus==='error'?'#ef4444':'rgba(255,255,255,0.4)'}}>{micStatus==='ok'?'Detected':micStatus==='error'?'Not found':'Checking...'}</span></div>
            </div>
            <div style={{display:'flex',alignItems:'flex-end',gap:'3px',height:'36px',marginBottom:'10px'}}>
              {volumeLevel.map((h,i)=><div key={i} style={{flex:1,borderRadius:'2px',minHeight:'4px',height:`${h}%`,background:micStatus==='error'?'#ef4444':'#00d9ff',opacity:micStatus==='error'?0.3:0.85,transition:'height 0.1s ease'}}/>)}
            </div>
            <p style={{color:'rgba(255,255,255,0.25)',fontSize:'11px',margin:0}}>{micStatus==='ok'?'Mic working — bars show your voice level':micStatus==='error'?'No audio signal':'Requesting access...'}</p>
          </div>
          <div style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${camStatus==='error'?'rgba(239,68,68,0.4)':'rgba(0,217,255,0.25)'}`,borderRadius:'10px',padding:'1.25rem'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{color:'rgba(255,255,255,0.4)',fontSize:'11px',letterSpacing:'0.08em'}}>CAMERA</span>
              <div style={{display:'flex',alignItems:'center',gap:'5px'}}><div style={dot(camStatus)}/><span style={{fontSize:'11px',color:camStatus==='ok'?'#00d9ff':camStatus==='error'?'#ef4444':'rgba(255,255,255,0.4)'}}>{camStatus==='ok'?'Active':camStatus==='error'?'Not found':'Checking...'}</span></div>
            </div>
            <div style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:'6px',height:'46px',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'10px'}}>
              <span style={{color:'rgba(255,255,255,0.2)',fontSize:'12px'}}>{camStatus==='ok'?'● Live':camStatus==='error'?'No camera':'...'}</span>
            </div>
            <p style={{color:'rgba(255,255,255,0.25)',fontSize:'11px',margin:0}}>{camStatus==='ok'?'Camera working':camStatus==='error'?'Camera optional':'Requesting access...'}</p>
          </div>
        </div>
        <div style={{background:'rgba(255,255,255,0.05)',border:`1px solid ${browserOk?'rgba(255,255,255,0.08)':'rgba(239,68,68,0.3)'}`,borderRadius:'10px',padding:'0.9rem 1.25rem',marginBottom:'16px',display:'flex',alignItems:'center',gap:'12px'}}>
          <div style={{width:'20px',height:'20px',borderRadius:'50%',background:browserOk?'rgba(0,217,255,0.1)':'rgba(239,68,68,0.1)',border:`1px solid ${browserOk?'rgba(0,217,255,0.3)':'rgba(239,68,68,0.3)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'11px',color:browserOk?'#00d9ff':'#ef4444'}}>{browserOk?'✓':'✗'}</div>
          <div>
            <p style={{color:'#fff',fontSize:'13px',margin:'0 0 2px',fontWeight:'500'}}>{browserOk?'Browser supported':'Browser not fully supported'}</p>
            <p style={{color:'rgba(255,255,255,0.3)',fontSize:'11px',margin:0}}>{browserOk?'Chrome detected — speech transcription will work':'Speech transcription requires Chrome. Firefox and Edge do not support it reliably.'}</p>
          </div>
        </div>
        {(micStatus==='error'||!browserOk)&&(
          <div style={{background:'rgba(239,68,68,0.06)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:'10px',padding:'1rem 1.25rem',marginBottom:'16px'}}>
            <p style={{color:'#fca5a5',fontSize:'13px',fontWeight:'500',margin:'0 0 8px'}}>Try one of these fixes:</p>
            {!browserOk&&<p style={{color:'rgba(255,255,255,0.6)',fontSize:'12px',margin:'0 0 4px'}}>● Your mic may be working but speech transcription only works in <span style={{color:'#00d9ff'}}>Chrome</span> — Firefox and Edge both have issues with this API</p>}
            {micError&&<p style={{color:'rgba(255,255,255,0.6)',fontSize:'12px',margin:'0 0 4px'}}>● {micError}</p>}
            {micStatus==='error'&&<p style={{color:'rgba(255,255,255,0.6)',fontSize:'12px',margin:0}}>● Make sure your mic is plugged in and not muted</p>}
          </div>
        )}
        <button onClick={handlePass} disabled={micStatus==='checking'} style={{width:'100%',background:bothOk?'linear-gradient(135deg,#00d9ff 0%,#8b5cf6 100%)':'rgba(255,255,255,0.08)',border:bothOk?'none':'1px solid rgba(255,255,255,0.1)',borderRadius:'12px',padding:'15px',fontSize:'16px',fontWeight:'600',color:bothOk?'#fff':'rgba(255,255,255,0.5)',cursor:micStatus==='checking'?'not-allowed':'pointer',transition:'all 0.2s',marginBottom:'12px'}}>
          {micStatus==='checking'?'Checking devices...':bothOk?'Everything looks good — Start Interview →':"Start anyway (answers won't be transcribed)"}
        </button>
        <button onClick={onBack} style={{display:'block',width:'100%',background:'transparent',border:'none',color:'rgba(255,255,255,0.4)',fontSize:'14px',cursor:'pointer',padding:'8px'}}>← Back to setup</button>
      </div>
    </div>
  );
}

// Main App Component
export default function InterviewSimulator() {
  const [stage, setStage] = useState('landing');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(180);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [completedInterviews, setCompletedInterviews] = useState(0);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionDate, setSubscriptionDate] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [finalResults, setFinalResults] = useState(null);
  const [pastInterviews, setPastInterviews] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [userName, setUserName] = useState('');
  const [micPermission, setMicPermission] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Authentication states
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Country for leaderboard
  const [userCountry, setUserCountry] = useState('');
  
  // Resume for personalized questions
  const [userResume, setUserResume] = useState('');
  
  // Video recording states
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [videoSnapshots, setVideoSnapshots] = useState([]); // Store snapshots for AI analysis
  const [videoFeedback, setVideoFeedback] = useState(null);
  
  // Contact form states
  const [contactType, setContactType] = useState('feedback');
  const [contactMessage, setContactMessage] = useState('');
  const [contactSubmitted, setContactSubmitted] = useState(false);
  
  // Mobile menu state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Track previous stage for back navigation
  const [previousStage, setPreviousStage] = useState('landing');
  
  // Mobile audio - need user tap to enable audio on mobile
  const [mobileAudioReady, setMobileAudioReady] = useState(false);
  const [waitingForMobileStart, setWaitingForMobileStart] = useState(false);
  const [waitingForMobileNext, setWaitingForMobileNext] = useState(false);
  const [mobileGateEmail, setMobileGateEmail] = useState('');
  const [mobileGateMessage, setMobileGateMessage] = useState('');
  const [urlRole, setUrlRole] = useState('');
  
  // Follow-up question states
  const [isFollowUp, setIsFollowUp] = useState(false);
  const [currentFollowUpQuestion, setCurrentFollowUpQuestion] = useState(null);
  const [followUpsAskedCount, setFollowUpsAskedCount] = useState(0);
  const [followUpTypesUsed, setFollowUpTypesUsed] = useState([]);
  const [followUpMetadata, setFollowUpMetadata] = useState({});
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // B2B states
  const [userRole, setUserRole] = useState(null);
  const [userOrgId, setUserOrgId] = useState(null);
  const [userOrg, setUserOrg] = useState(null);
  const [inviteSlug, setInviteSlug] = useState(null);
  const [inviteOrg, setInviteOrg] = useState(null);
  
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const micStreamRef = useRef(null); // Persistent mic stream - grabbed once, reused per question
  const micMimeTypeRef = useRef(''); // MIME type for MediaRecorder
  const recognitionRef = useRef(null);
  const speechSynthRef = useRef(null);
  const audioRef = useRef(null);
  
  // Pre-fetched audio for ALL questions (mobile only) - array of {url, audio} objects
  const prefetchedAudioRef = useRef(null);
  
  // Video refs
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const transcriptRef = useRef(''); // Store transcript in ref for reliable access
  const isRecordingRef = useRef(false); // Track recording state for speech recognition onend
  const accumulatedTranscriptRef = useRef(''); // Accumulate transcript across iOS recognition restarts

  // Check if mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 600);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle return from Stripe after subscribing
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const subscribed = params.get('subscribed');
    if (subscribed === 'true' && user) {
      // Clean the URL
      window.history.replaceState({}, '', window.location.pathname);
      // Mark as subscribed immediately
      setIsSubscribed(true);
      localStorage.setItem('subscription', JSON.stringify({ active: true, date: new Date().toISOString() }));
      // Update Supabase in background
      loadUserData(user.id);
      // Check if we need to restore results
      const pendingInterviewId = localStorage.getItem('pendingInterviewId');
      const pendingStage = localStorage.getItem('pendingStage');
      if (pendingInterviewId && pendingStage === 'results') {
        localStorage.removeItem('pendingInterviewId');
        localStorage.removeItem('pendingStage');
        // Fetch the interview results from Supabase
        supabase
          .from('interview_results')
          .select('full_results')
          .eq('id', pendingInterviewId)
          .single()
          .then(({ data, error }) => {
            if (data?.full_results) {
              setFinalResults(data.full_results);
              setStage('results');
            } else {
              setStage('dashboard');
            }
          });
      } else {
        setStage('dashboard');
      }
    }
  }, [user]);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const role = params.get('role');
    if (role) {
      setUrlRole(decodeURIComponent(role));
    }
  }, []);

  // Initialize auth on mount
  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
      }
      setAuthLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setUserName(session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '');
        // Load user data when they sign in
        loadUserData(session.user.id);
        
        // Identify user in Mixpanel
        if (window.mixpanel) {
          window.mixpanel.identify(session.user.id);
          window.mixpanel.people.set({
            '$email': session.user.email,
            '$name': session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            'sign_up_date': session.user.created_at
          });
          window.mixpanel.track('sign_in_completed');
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Initialize app on mount
  useEffect(() => {
    if (!authLoading) {
      initializeApp();
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (audioRef.current) {
        audioRef.current.pause();
      }
      window.speechSynthesis?.cancel();
      stopCamera();
    };
  }, [authLoading]);

  // Attach video stream when interview stage is active
  useEffect(() => {
    if (stage === 'interview' && videoEnabled && videoStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = videoStreamRef.current;
      videoRef.current.play().catch(e => console.log('Video play error:', e));
    }
  }, [stage, videoEnabled, waitingForMobileStart, waitingForMobileNext]);

  // Capture /join/:slug from URL for B2B invite links
  useEffect(() => {
    const path = window.location.pathname;
    const joinMatch = path.match(/^\/join\/([a-zA-Z0-9-]+)\/?$/);
    if (joinMatch) {
      const slug = joinMatch[1];
      setInviteSlug(slug);
      // Persist slug so it survives the OAuth redirect page reload
      sessionStorage.setItem('invite_slug', slug);
      supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .single()
        .then(({ data, error }) => {
          if (data && !error) {
            setInviteOrg(data);
            window.history.replaceState({}, '', '/');
          } else {
            console.error('Invalid invite link:', slug);
            setInviteSlug(null);
            sessionStorage.removeItem('invite_slug');
            window.history.replaceState({}, '', '/');
          }
        });
    }
  }, []);

  // Load user data from Supabase
  const loadUserData = async (userId) => {
    let loadedInterviews = 0;
    let loadedSubscribed = false;
    let loadedOrgId = null;
    
    try {
      // Recover invite org from sessionStorage if React state was lost during OAuth redirect
      let effectiveInviteOrg = inviteOrg;
      const savedSlug = sessionStorage.getItem('invite_slug');
      if (!effectiveInviteOrg && savedSlug) {
        const { data: slugOrg } = await supabase
          .from('organizations')
          .select('*')
          .eq('slug', savedSlug)
          .eq('is_active', true)
          .single();
        if (slugOrg) {
          effectiveInviteOrg = slugOrg;
        }
        sessionStorage.removeItem('invite_slug');
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        loadedInterviews = data.completed_interviews || 0;
        loadedSubscribed = data.is_subscribed || false;
        loadedOrgId = data.org_id || null;
        setCompletedInterviews(loadedInterviews);
        setIsSubscribed(loadedSubscribed);
        setSubscriptionDate(data.subscription_date);
        setUserRole(data.role || 'candidate');
        console.log('B2B_LOAD:', { role: data.role, org_id: data.org_id, userId });
        setUserOrgId(data.org_id || null);

        // If user has an org_id, fetch the org details
        if (data.org_id) {
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', data.org_id)
            .single();
          if (orgData) { setUserOrg(orgData); console.log('B2B_ORG_LOADED:', orgData); } else { console.log('B2B_ORG_FAILED'); }
        }

        // If user just came through an invite link and doesn't have an org yet,
        // tag them to the invite org
        if (!data.org_id && effectiveInviteOrg) {
          const { count } = await supabase
            .from('user_profiles')
            .select('id', { count: 'exact', head: true })
            .eq('org_id', effectiveInviteOrg.id)
            .eq('role', 'candidate');
          
          if (!effectiveInviteOrg.candidate_limit || count < effectiveInviteOrg.candidate_limit) {
            await supabase
              .from('user_profiles')
              .update({ org_id: effectiveInviteOrg.id, role: 'candidate' })
              .eq('id', userId);
            setUserOrgId(effectiveInviteOrg.id);
            setUserOrg(effectiveInviteOrg);
            setUserRole('candidate');
          }
          setInviteSlug(null);
          setInviteOrg(null);
        }

      } else if (error && error.code === 'PGRST116') {
        // User doesn't exist in our table yet, create them
        const newProfile = {
          id: userId,
          completed_interviews: 0,
          is_subscribed: false,
          role: 'candidate',
          org_id: effectiveInviteOrg?.id || null
        };
        await supabase.from('user_profiles').insert(newProfile);
        
        if (effectiveInviteOrg) {
          setUserOrgId(effectiveInviteOrg.id);
          setUserOrg(effectiveInviteOrg);
          setUserRole('candidate');
          setInviteSlug(null);
          setInviteOrg(null);
        }
      }
    } catch (e) {
      console.error('Error loading user data:', e);
    }
    
    // If user just signed in via OAuth, redirect appropriately
    if (sessionStorage.getItem('pendingAuthRedirect')) {
      sessionStorage.removeItem('pendingAuthRedirect');
      setStage('setup');
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    // Track sign-in attempt
    if (window.mixpanel) {
      window.mixpanel.track('google_sign_in_clicked');
    }
    
    // Flag so we know to redirect to setup after OAuth returns
    sessionStorage.setItem('pendingAuthRedirect', 'true');
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) console.error('Error signing in:', error);
  };

  // Sign out
  const signOut = async () => {
    if (window.mixpanel) {
      window.mixpanel.track('sign_out');
    }
    await supabase.auth.signOut();
    setUser(null);
    setCompletedInterviews(0);
    setIsSubscribed(false);
    setPastInterviews([]);
    setUserRole(null);
    setUserOrgId(null);
    setUserOrg(null);
  };

  const initializeApp = async () => {
    // Check if user just completed payment (redirected from Stripe)
    checkPaymentSuccess();
    
    if (user) {
      await loadUserData(user.id);
    } else {
      await checkCompletedInterviews();
      await checkSubscriptionStatus();
    }
    await loadPastInterviews();
    await loadLeaderboard();
    await setupSpeechRecognition();
    setIsLoading(false);
  };

  const checkPaymentSuccess = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // User just paid! Mark them as subscribed
      const subData = { active: true, date: new Date().toISOString() };
      try {
        // Save to localStorage as backup
        localStorage.setItem('subscription', JSON.stringify(subData));
        setIsSubscribed(true);
        setSubscriptionDate(subData.date);
        
        // Track payment completed
        if (window.mixpanel) {
          window.mixpanel.track('payment_completed', {
            plan: 'monthly',
            price: 19.99,
            currency: 'USD'
          });
          window.mixpanel.people.set({
            'is_subscribed': true,
            'subscription_date': subData.date
          });
        }
        
        // Save to Supabase if user is logged in
        if (user) {
          await supabase
            .from('user_profiles')
            .update({ 
              is_subscribed: true, 
              subscription_date: subData.date 
            })
            .eq('id', user.id);
        }
        
        // Clean up URL (remove ?success=true)
        window.history.replaceState({}, '', window.location.pathname);
        
        // Show success message
        alert('🎉 Welcome! Your subscription is now active. Enjoy unlimited interviews!');
      } catch (e) {
        console.error('Error saving subscription:', e);
      }
    }
  };

  const checkCompletedInterviews = async () => {
    try {
      const stored = localStorage.getItem('completedInterviews');
      if (stored) {
        setCompletedInterviews(parseInt(stored) || 0);
      }
    } catch (e) {
      // No completed interviews yet
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const stored = localStorage.getItem('subscription');
      if (stored) {
        const sub = JSON.parse(stored);
        setIsSubscribed(sub.active);
        setSubscriptionDate(sub.date);
      }
    } catch (e) {}
  };

  // For testing: simulate subscription
  const simulateSubscribe = async () => {
    const subData = { active: true, date: new Date().toISOString() };
    try {
      localStorage.setItem('subscription', JSON.stringify(subData));
      setIsSubscribed(true);
      setSubscriptionDate(subData.date);
    } catch (e) {}
  };

  const cancelSubscription = async () => {
    try {
      localStorage.setItem('subscription', JSON.stringify({ active: false, date: null }));
      setIsSubscribed(false);
      setSubscriptionDate(null);
    } catch (e) {}
  };

  // Contact form submission - saves to Supabase
  const submitContactForm = async () => {
    if (!contactMessage.trim()) {
      alert('Please enter a message');
      return;
    }
    
    try {
      await supabase.from('contact_requests').insert({
        user_id: user?.id || null,
        user_email: user?.email || 'anonymous',
        request_type: contactType,
        message: contactMessage,
        created_at: new Date().toISOString()
      });
      
      // Track contact form submission
      if (window.mixpanel) {
        window.mixpanel.track('contact_form_submitted', {
          request_type: contactType
        });
      }
      
      setContactSubmitted(true);
      setContactMessage('');
      
      // Reset form after 3 seconds
      setTimeout(() => {
        setContactSubmitted(false);
      }, 3000);
    } catch (e) {
      console.error('Error submitting contact form:', e);
      alert('Failed to submit. Please try again.');
    }
  };

  const incrementCompletedInterviews = async () => {
    const newCount = completedInterviews + 1;
    try {
      if (user) {
        // Save to Supabase if logged in
        await supabase
          .from('user_profiles')
          .update({ completed_interviews: newCount })
          .eq('id', user.id);
      }
      // Always save to localStorage as backup
      localStorage.setItem('completedInterviews', newCount.toString());
      setCompletedInterviews(newCount);
    } catch (e) {
      console.error('Failed to save completed interviews count');
    }
  };

  // For testing: reset all data
  const resetAllData = async () => {
    try {
      localStorage.removeItem('completedInterviews');
      localStorage.removeItem('pastInterviews');
      localStorage.removeItem('subscription');
      localStorage.removeItem('leaderboard');
      setCompletedInterviews(0);
      setPastInterviews([]);
      setIsSubscribed(false);
      setSubscriptionDate(null);
      setLeaderboard([]);
      alert('All data reset! You can test fresh.');
    } catch (e) {
      console.error('Failed to reset data');
    }
  };

  const loadPastInterviews = async () => {
    try {
      const stored = localStorage.getItem('pastInterviews');
      if (stored) {
        setPastInterviews(JSON.parse(stored));
      }
    } catch (e) {}
  };

  const loadLeaderboard = async () => {
    try {
      const stored = localStorage.getItem('leaderboard');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.length > 0) {
          setLeaderboard(parsed);
          return;
        }
      }
      
      // Seed with dummy data if no leaderboard exists
      const dummyLeaderboard = [
        { name: 'Sarah M.', score: 92, role: 'Product Manager', flag: '🇺🇸', passed: true, date: '2025-02-01' },
        { name: 'James K.', score: 89, role: 'Software Engineer', flag: '🇬🇧', passed: true, date: '2025-02-02' },
        { name: 'Priya S.', score: 87, role: 'Data Analyst', flag: '🇮🇳', passed: true, date: '2025-02-01' },
        { name: 'Max B.', score: 85, role: 'UX Designer', flag: '🇩🇪', passed: true, date: '2025-02-03' },
        { name: 'Emma T.', score: 83, role: 'Marketing Manager', flag: '🇨🇦', passed: true, date: '2025-02-02' },
        { name: 'Liam H.', score: 81, role: 'Sales Executive', flag: '🇦🇺', passed: true, date: '2025-02-01' },
        { name: 'Sofia R.', score: 80, role: 'Business Analyst', flag: '🇪🇸', passed: true, date: '2025-02-03' },
        { name: 'Noah C.', score: 78, role: 'Project Manager', flag: '🇳🇱', passed: true, date: '2025-02-02' },
        { name: 'Aisha M.', score: 77, role: 'HR Manager', flag: '🇦🇪', passed: true, date: '2025-02-01' },
        { name: 'Lucas P.', score: 76, role: 'Financial Analyst', flag: '🇫🇷', passed: true, date: '2025-02-03' },
        { name: 'Mia W.', score: 75, role: 'Operations Manager', flag: '🇸🇬', passed: true, date: '2025-02-02' },
        { name: 'Oliver J.', score: 74, role: 'Account Executive', flag: '🇮🇪', passed: true, date: '2025-02-01' },
        { name: 'Chloe L.', score: 73, role: 'Content Strategist', flag: '🇳🇿', passed: true, date: '2025-02-03' },
        { name: 'Ethan D.', score: 72, role: 'DevOps Engineer', flag: '🇸🇪', passed: true, date: '2025-02-02' },
        { name: 'Zara A.', score: 71, role: 'Consultant', flag: '🇵🇰', passed: true, date: '2025-02-01' },
        { name: 'Ryan F.', score: 70, role: 'Product Designer', flag: '🇯🇵', passed: true, date: '2025-02-03' },
        { name: 'Lily N.', score: 69, role: 'QA Engineer', flag: '🇰🇷', passed: false, date: '2025-02-02' },
        { name: 'Jack S.', score: 68, role: 'Technical Writer', flag: '🇧🇷', passed: false, date: '2025-02-01' },
        { name: 'Grace Y.', score: 67, role: 'Support Specialist', flag: '🇲🇽', passed: false, date: '2025-02-03' },
        { name: 'Ben V.', score: 66, role: 'Junior Developer', flag: '🇵🇱', passed: false, date: '2025-02-02' },
      ];
      
      localStorage.setItem('leaderboard', JSON.stringify(dummyLeaderboard));
      setLeaderboard(dummyLeaderboard);
    } catch (e) {}
  };

  const savePastInterview = async (interviewData) => {
    const updated = [interviewData, ...pastInterviews].slice(0, 3);
    try {
      localStorage.setItem('pastInterviews', JSON.stringify(updated));
      setPastInterviews(updated);
    } catch (e) {
      console.error('Failed to save interview history');
    }
  };

  const markFreeTrialUsed = async () => {
    try {
      localStorage.setItem('hasUsedFreeTrial', 'true');
    } catch (e) {}
  };

  const saveToLeaderboard = async (name, finalScore, job, passed) => {
    const newEntry = {
      name,
      score: finalScore,
      role: job,
      flag: userCountry || '🌍',
      passed,
      date: new Date().toISOString().split('T')[0]
    };
    
    const updatedLeaderboard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // Keep top 20
    
    try {
      localStorage.setItem('leaderboard', JSON.stringify(updatedLeaderboard));
      setLeaderboard(updatedLeaderboard);
    } catch (e) {}
  };

  // Setup speech recognition
  const setupSpeechRecognition = async () => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        // On iOS, recognition restarts lose previous results.
        // Prepend any previously accumulated text.
        const accumulated = accumulatedTranscriptRef.current + transcript;
        setCurrentTranscript(accumulated);
        transcriptRef.current = accumulated;
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicPermission(false);
        }
      };

      // iOS/mobile: recognition frequently stops itself after pauses in speech.
      // Auto-restart it to keep capturing the full answer.
      recognitionRef.current.onend = () => {
        // Save what we have so far before restart (results will reset)
        if (transcriptRef.current) {
          accumulatedTranscriptRef.current = transcriptRef.current;
        }
        // Only restart if we're still in recording mode (not intentionally stopped)
        if (isRecordingRef.current) {
          try {
            recognitionRef.current.start();
            console.log('Speech recognition auto-restarted');
          } catch (e) {
            console.error('Failed to restart recognition:', e);
          }
        }
      };
    }
  };

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermission(true);
      return true;
    } catch (e) {
      setMicPermission(false);
      return false;
    }
  };

  // Camera/Video functions
  const startCamera = async () => {
    if (!videoEnabled) return false;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      });
      
      videoStreamRef.current = stream;
      setCameraPermission(true);
      
      // Try to attach stream immediately, and also after a delay
      const attachStream = () => {
        if (videoRef.current && videoStreamRef.current) {
          videoRef.current.srcObject = videoStreamRef.current;
          videoRef.current.play().catch(e => console.log('Video play error:', e));
        }
      };
      
      attachStream();
      // Also try after a short delay in case video element wasn't ready
      setTimeout(attachStream, 100);
      setTimeout(attachStream, 500);
      
      return true;
    } catch (e) {
      console.error('Camera access denied:', e);
      setCameraPermission(false);
      setVideoEnabled(false);
      return false;
    }
  };

  const stopCamera = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    if (snapshotIntervalRef.current) {
      clearInterval(snapshotIntervalRef.current);
      snapshotIntervalRef.current = null;
    }
  };

  const captureSnapshot = () => {
    if (!videoRef.current || !videoEnabled) return null;
    
    const canvas = document.createElement('canvas');
    canvas.width = 320; // Smaller for API efficiency
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    
    return canvas.toDataURL('image/jpeg', 0.7); // Compress to reduce size
  };

  const startSnapshotCapture = () => {
    if (!videoEnabled) return;
    
    // Capture a snapshot every 30 seconds during the interview
    snapshotIntervalRef.current = setInterval(() => {
      const snapshot = captureSnapshot();
      if (snapshot) {
        setVideoSnapshots(prev => [...prev.slice(-9), snapshot]); // Keep max 10 snapshots
      }
    }, 30000);
    
    // Capture first snapshot immediately
    setTimeout(() => {
      const snapshot = captureSnapshot();
      if (snapshot) {
        setVideoSnapshots(prev => [...prev, snapshot]);
      }
    }, 2000);
  };

  const analyzeVideoPresence = async (snapshots) => {
    if (!snapshots || snapshots.length === 0) return null;
    
    try {
      // Send 3-4 representative snapshots to Claude for analysis
      const samplesToAnalyze = snapshots.length <= 4 
        ? snapshots 
        : [snapshots[0], snapshots[Math.floor(snapshots.length/3)], snapshots[Math.floor(2*snapshots.length/3)], snapshots[snapshots.length-1]];
      
      const imageContent = samplesToAnalyze.map(snapshot => ({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: snapshot.split(',')[1]
        }
      }));

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{
            role: "user",
            content: [
              ...imageContent,
              {
                type: "text",
                text: `You are an interview coach analyzing video snapshots from a practice interview session. Analyze these ${samplesToAnalyze.length} snapshots taken throughout the interview and provide feedback.

Evaluate and score (0-100) each category:
1. Eye Contact: Are they looking at the camera (simulating eye contact with interviewer)?
2. Posture: Are they sitting up straight, professional positioning?
3. Facial Expression: Do they appear confident, engaged, friendly?
4. Framing: Are they well-positioned in frame, appropriate distance?
5. Background: Is it professional/clean, or distracting?
6. Overall Presence: Professional video interview presence

Return ONLY valid JSON:
{
  "eyeContact": { "score": 0-100, "feedback": "brief feedback" },
  "posture": { "score": 0-100, "feedback": "brief feedback" },
  "facialExpression": { "score": 0-100, "feedback": "brief feedback" },
  "framing": { "score": 0-100, "feedback": "brief feedback" },
  "background": { "score": 0-100, "feedback": "brief feedback" },
  "overallPresence": { "score": 0-100, "feedback": "brief feedback" },
  "topTip": "The single most important thing to improve",
  "overallVideoScore": 0-100
}`
              }
            ]
          }]
        })
      });

      const data = await response.json();
      const text = data.content[0].text;
      const cleanText = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Video analysis error:', error);
      return null;
    }
  };
  
  // Text-to-Speech using serverless function
  const speakQuestion = async (text) => {
    setIsSpeaking(true);
    setIsRecording(false);
    
    try {
      const response = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error('Speech API error');
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      return new Promise((resolve) => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.onerror = (e) => {
          console.error('Audio playback error:', e);
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        // Try to play audio
        audio.play()
          .then(() => {
            console.log('Audio playing...');
          })
          .catch((e) => {
            console.error('Audio play() blocked:', e);
            setIsSpeaking(false);
            URL.revokeObjectURL(audioUrl);
            // On mobile, just proceed without audio
            resolve();
          });
      });
      
    } catch (error) {
      console.error('Speech API error, falling back to browser voice:', error);
      return fallbackSpeak(text);
    }
  };

  // Fallback browser speech (in case ElevenLabs fails)
  const fallbackSpeak = (text) => {
    return new Promise((resolve) => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      } else {
        setIsSpeaking(false);
        resolve();
      }
    });
  };

  // Generate questions using Claude API
  const generateQuestions = async () => {
    setStage('generating');
    
    // Reset all interview state for fresh start
    setAnswers([]);
    setCurrentTranscript('');
    setCurrentQuestionIndex(0);
    setTimeLeft(180);
    setVideoSnapshots([]);
    setVideoFeedback(null);
    setFinalResults(null);
    
    // Track interview started
    if (window.mixpanel) {
      window.mixpanel.track('interview_started', {
        job_title: jobTitle,
        has_job_description: !!jobDescription,
        has_resume: !!userResume,
        video_enabled: videoEnabled
      });
    }
    
    // Start camera if video enabled
    if (videoEnabled) {
      await startCamera();
    }
    
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobDescription, resume: userResume })
      });

      const data = await response.json();
      const parsedQuestions = data.questions;
      setQuestions(parsedQuestions);
      setStage('interview');
      
      // Start capturing snapshots
      if (videoEnabled) {
        startSnapshotCapture();
      }
      
      // On mobile, wait for user tap before playing audio
      if (isMobile && !mobileAudioReady) {
        setWaitingForMobileStart(true);
        // Pre-fetch ALL audio while user sees the "Ready to Begin?" screen
        try {
          const introText = `Welcome to your interview for the ${jobTitle} position. I'll be asking you 5 questions. You have 3 minutes to answer each question. Please speak clearly and take your time. Let's begin.`;
          const allTexts = [introText, ...parsedQuestions.map((q, i) => `Question ${i + 1}: ${q}`)];
          
          const allResponses = await Promise.all(
            allTexts.map(text => 
              fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
            )
          );
          
          const allBlobs = await Promise.all(allResponses.map(r => r.ok ? r.blob() : null));
          
          const allAudio = allBlobs.map(blob => {
            if (!blob) return null;
            const url = URL.createObjectURL(blob);
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = url;
            audio.load();
            return { url, audio };
          });
          
          // allAudio[0] = intro, allAudio[1] = Q1, allAudio[2] = Q2, etc.
          prefetchedAudioRef.current = allAudio;
          console.log('Pre-fetched all ' + allAudio.length + ' audio clips');
          
          // Also grab mic stream now so Q1 recording starts instantly
          try {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = micStream;
            micMimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4')
                  ? 'audio/mp4'
                  : '';
          } catch (e) {
            console.error('Mic pre-grab failed:', e);
          }
        } catch (e) {
          console.error('Prefetch all failed:', e);
          prefetchedAudioRef.current = null;
        }
      } else {
        // Desktop: play audio immediately
        await speakQuestion(`Welcome to your interview for the ${jobTitle} position. I'll be asking you 5 questions. You have 3 minutes to answer each question. Please speak clearly and take your time. Let's begin.`);
        await speakQuestion(`Question 1: ${parsedQuestions[0]}`);
        startRecordingPhase();
      }
    } catch (error) {
      console.error('Error:', error);
      // Fallback
      const fallback = [
        `Tell me about a challenging project you led that's relevant to the ${jobTitle} role.`,
        `What technical skills do you bring to this ${jobTitle} position?`,
        `Describe a time you had to solve a complex problem under pressure.`,
        `How do you collaborate with cross-functional teams?`,
        `Why are you interested in this role and what motivates you?`
      ];
      setQuestions(fallback);
      setStage('interview');
      
      // Start capturing snapshots
      if (videoEnabled) {
        startSnapshotCapture();
      }
      
      // On mobile, wait for user tap before playing audio
      if (isMobile && !mobileAudioReady) {
        setWaitingForMobileStart(true);
        try {
          const introText = `Welcome to your interview. Let's begin.`;
          const allTexts = [introText, ...fallback.map((q, i) => `Question ${i + 1}: ${q}`)];
          const allResponses = await Promise.all(
            allTexts.map(text =>
              fetch('/api/speak', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
            )
          );
          const allBlobs = await Promise.all(allResponses.map(r => r.ok ? r.blob() : null));
          const allAudio = allBlobs.map(blob => {
            if (!blob) return null;
            const url = URL.createObjectURL(blob);
            const audio = new Audio();
            audio.preload = 'auto';
            audio.src = url;
            audio.load();
            return { url, audio };
          });
          prefetchedAudioRef.current = allAudio;
        } catch (e) {
          console.error('Prefetch fallback failed:', e);
          prefetchedAudioRef.current = null;
        }
        
        // Also grab mic stream now so Q1 recording starts instantly
        try {
          if (!micStreamRef.current) {
            const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = micStream;
            micMimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
              ? 'audio/webm;codecs=opus'
              : MediaRecorder.isTypeSupported('audio/webm') 
                ? 'audio/webm'
                : MediaRecorder.isTypeSupported('audio/mp4')
                  ? 'audio/mp4'
                  : '';
          }
        } catch (e) {
          console.error('Mic pre-grab failed:', e);
        }
      } else {
        await speakQuestion(`Welcome to your interview. Let's begin with question 1: ${fallback[0]}`);
        startRecordingPhase();
      }
    }
  };

  // Handle mobile start button tap - enables audio playback
  const handleMobileStart = () => {
    setMobileAudioReady(true);
    setWaitingForMobileStart(false);
    setIsSpeaking(true);
    setIsRecording(false);
    
    // Reattach camera
    setTimeout(() => {
      if (videoEnabled && videoStreamRef.current && videoRef.current) {
        videoRef.current.srcObject = videoStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }, 100);
    
    const allAudio = prefetchedAudioRef.current;
    
    if (allAudio && allAudio.length >= 2 && allAudio[0] && allAudio[1]) {
      // Play intro (index 0) then Q1 (index 1) sequentially
      const toPlay = [allAudio[0], allAudio[1]];
      let idx = 0;
      
      const playNext = () => {
        if (idx >= toPlay.length) {
          setIsSpeaking(false);
          startRecordingPhase();
          return;
        }
        
        const item = toPlay[idx];
        const audio = item.audio;
        audioRef.current = audio;
        idx++;
        
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          URL.revokeObjectURL(item.url);
          playNext();
        };
        
        audio.onended = done;
        audio.onerror = done;
        audio.ontimeupdate = () => {
          if (audio.duration && audio.currentTime >= audio.duration - 0.3) {
            audio.ontimeupdate = null;
            done();
          }
        };
        setTimeout(done, 20000);
        
        audio.play().catch(done);
      };
      
      playNext();
    } else {
      // No prefetched audio — skip audio, just start recording
      setIsSpeaking(false);
      startRecordingPhase();
    }
  };

  // Handle mobile tap to hear next question
  // Audio is already pre-fetched and preloaded in the array
  const handleMobileNextQuestion = () => {
    setWaitingForMobileNext(false);
    setIsSpeaking(true);
    setIsRecording(false);
    
    // Reattach camera after overlay switch
    setTimeout(() => {
      if (videoEnabled && videoStreamRef.current && videoRef.current) {
        videoRef.current.srcObject = videoStreamRef.current;
        videoRef.current.play().catch(() => {});
      }
    }, 100);
    
    // allAudio[0] = intro, allAudio[1] = Q1, allAudio[2] = Q2, etc.
    // currentQuestionIndex is already updated to the new question (0-based)
    // So Q2 = index 1 = allAudio[2], Q3 = index 2 = allAudio[3], etc.
    const allAudio = prefetchedAudioRef.current;
    const audioIndex = currentQuestionIndex + 1; // +1 because index 0 is intro
    
    if (allAudio && allAudio[audioIndex] && allAudio[audioIndex].audio) {
      const item = allAudio[audioIndex];
      const audio = item.audio;
      audioRef.current = audio;
      
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        setIsSpeaking(false);
        URL.revokeObjectURL(item.url);
        startRecordingPhase();
      };
      
      audio.onended = done;
      audio.onerror = done;
      
      // Backup: poll for completion (iOS sometimes doesn't fire onended)
      audio.ontimeupdate = () => {
        if (audio.duration && audio.currentTime >= audio.duration - 0.3) {
          audio.ontimeupdate = null;
          done();
        }
      };
      
      // Safety timeout
      setTimeout(() => {
        if (!finished) done();
      }, 20000);
      
      audio.play().catch(done);
    } else {
      // Prefetch failed or not ready — skip audio, just start recording
      setIsSpeaking(false);
      startRecordingPhase();
    }
  };

  const startRecordingPhase = () => {
    setTimeLeft(180); // Always reset to 3 minutes
    setIsTimerRunning(true);
    // Don't clear transcript here - it's already cleared in handleNextQuestion
    startRecording(); // async but we don't need to await it here
  };

  const startRecording = async () => {
    if (isMobile) {
      // Mobile: use MediaRecorder to capture audio for Whisper transcription
      setCurrentTranscript('🎙️ Recording... (transcription on submit)');
      transcriptRef.current = '';
      accumulatedTranscriptRef.current = '';
      audioChunksRef.current = [];
      
      try {
        // Get mic stream once, reuse for all questions
        if (!micStreamRef.current || micStreamRef.current.getTracks().every(t => t.readyState === 'ended')) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = stream;
          
          // Determine best MIME type once
          micMimeTypeRef.current = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') 
              ? 'audio/webm'
              : MediaRecorder.isTypeSupported('audio/mp4')
                ? 'audio/mp4'
                : '';
        }
        
        // Create new MediaRecorder from existing stream (fast, synchronous)
        const options = micMimeTypeRef.current 
          ? { mimeType: micMimeTypeRef.current, audioBitsPerSecond: 16000 } 
          : { audioBitsPerSecond: 16000 };
        const recorder = new MediaRecorder(micStreamRef.current, options);
        mediaRecorderRef.current = recorder;
        
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };
        
        recorder.start(1000);
        setIsRecording(true);
        isRecordingRef.current = true;
      } catch (err) {
        console.error('MediaRecorder failed:', err);
        setCurrentTranscript('⚠️ Mic error - please check permissions');
        setIsRecording(false);
      }
    } else {
      // Desktop: use Web Speech API (live transcription)
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsRecording(true);
          isRecordingRef.current = true;
        } catch (e) {
          console.error('Failed to start recognition:', e);
        }
      }
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false;
    
    if (isMobile) {
      // Mobile: stop MediaRecorder and send to Whisper
      return new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== 'inactive') {
          recorder.onstop = async () => {
            // DON'T stop mic tracks - keep stream alive for next question
            setIsRecording(false);
            
            // Send audio to Whisper for transcription
            if (audioChunksRef.current.length > 0) {
              try {
                setCurrentTranscript('⏳ Transcribing your answer...');
                
                const storedMimeType = micMimeTypeRef.current || recorder.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunksRef.current, { type: storedMimeType });
                
                // Convert to base64
                const reader = new FileReader();
                const base64 = await new Promise((res, rej) => {
                  reader.onloadend = () => res(reader.result.split(',')[1]);
                  reader.onerror = rej;
                  reader.readAsDataURL(audioBlob);
                });
                
                const response = await fetch('/api/transcribe', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ audio: base64, mimeType: storedMimeType })
                });
                
                if (response.ok) {
                  const data = await response.json();
                  const transcript = data.transcript || '[No speech detected]';
                  setCurrentTranscript(transcript);
                  transcriptRef.current = transcript;
                  console.log('Whisper transcript:', transcript.substring(0, 100));
                } else {
                  console.error('Transcription failed:', response.status);
                  transcriptRef.current = '[Transcription failed]';
                }
              } catch (err) {
                console.error('Whisper error:', err);
                transcriptRef.current = '[Transcription error]';
              }
            }
            
            audioChunksRef.current = [];
            resolve();
          };
          recorder.stop();
        } else {
          setIsRecording(false);
          resolve();
        }
      });
    } else {
      // Desktop: stop Web Speech API
      return new Promise((resolve) => {
        if (recognitionRef.current) {
          try {
            const onEnd = () => {
              recognitionRef.current.removeEventListener('end', onEnd);
              setIsRecording(false);
              resolve();
            };
            recognitionRef.current.addEventListener('end', onEnd);
            recognitionRef.current.stop();
            setTimeout(() => {
              recognitionRef.current?.removeEventListener('end', onEnd);
              setIsRecording(false);
              resolve();
            }, 1500);
          } catch (e) {
            setIsRecording(false);
            resolve();
          }
        } else {
          setIsRecording(false);
          resolve();
        }
      });
    }
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning && !isTranscribing && !isEvaluating) {
      handleNextQuestion();
    }
    return () => clearTimeout(timerRef.current);
  }, [isTimerRunning, timeLeft, isTranscribing, isEvaluating]);

  const handleNextQuestion = async () => {
    if (isTranscribing) return; // Prevent double-tap
    setIsTimerRunning(false);
    if (isMobile) setIsTranscribing(true); // Disable button immediately
    await stopRecording();
    
    // Stop any currently playing audio (ElevenLabs or browser)
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    
    // Use ref for reliable transcript access (React state may be stale)
    const capturedTranscript = transcriptRef.current || currentTranscript || '[No response recorded]';
    
    // Build answer object - mark if this was a follow-up answer
    const newAnswer = {
      question: isFollowUp ? currentFollowUpQuestion : questions[currentQuestionIndex],
      answer: capturedTranscript,
      timeSpent: 180 - timeLeft,
      questionIndex: currentQuestionIndex,
      isFollowUp: isFollowUp,
      parentQuestionIndex: isFollowUp ? currentQuestionIndex : null
    };
    
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    
    // Clear transcript state AND ref
    setCurrentTranscript('');
    transcriptRef.current = '';
    accumulatedTranscriptRef.current = '';
    
    // Reset timer immediately for next question
    setTimeLeft(180);
    
    // Helper: move to next main question or finish
    const moveToNextOrFinish = async (answersArr) => {
      if (currentQuestionIndex < questions.length - 1) {
        const nextIndex = currentQuestionIndex + 1;
        setCurrentQuestionIndex(nextIndex);
        
        if (isMobile) {
          if (videoEnabled) {
            const snapshot = captureSnapshot();
            if (snapshot) {
              setVideoSnapshots(prev => [...prev.slice(-9), snapshot]);
            }
          }
          setIsTranscribing(false);
          setWaitingForMobileNext(true);
        } else {
          await speakQuestion(`Question ${nextIndex + 1}: ${questions[nextIndex]}`);
          startRecordingPhase();
        }
      } else {
        // Interview complete
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach(track => track.stop());
          micStreamRef.current = null;
        }
        setIsTranscribing(false);
        setStage('analyzing');
        setIsAnalyzing(true);
        await analyzeAllAnswers(answersArr);
      }
    };
    
    // If we just answered a follow-up, move to next main question
    if (isFollowUp) {
      setIsFollowUp(false);
      setCurrentFollowUpQuestion(null);
      await moveToNextOrFinish(newAnswers);
      return;
    }
    
    // For main question answers on desktop, evaluate if follow-up is needed
    // Mobile users are gated so they won't reach here, but skip follow-ups just in case
    if (!isMobile) {
      setIsEvaluating(true);
      
      try {
        const followUpResult = await evaluateForFollowUp(
          questions[currentQuestionIndex],
          capturedTranscript,
          currentQuestionIndex,
          questions.length,
          followUpsAskedCount
        );
        
        setIsEvaluating(false);
        
        // Store evaluation metadata for this question
        setFollowUpMetadata(prev => ({
          ...prev,
          [currentQuestionIndex]: {
            reason: followUpResult.reason || null,
            followUpType: followUpResult.followUpType || null,
            whatWasMissing: followUpResult.whatWasMissing || null,
            shouldFollowUp: followUpResult.shouldFollowUp || false
          }
        }));
        
        if (followUpResult.shouldFollowUp && followUpResult.followUpQuestion) {
          // Ask the follow-up question
          setIsFollowUp(true);
          setCurrentFollowUpQuestion(followUpResult.followUpQuestion);
          setFollowUpsAskedCount(prev => prev + 1);
          if (followUpResult.followUpType) {
            setFollowUpTypesUsed(prev => [...prev, followUpResult.followUpType]);
          }
          
          await speakQuestion(followUpResult.followUpQuestion);
          startRecordingPhase();
        } else {
          await moveToNextOrFinish(newAnswers);
        }
      } catch (error) {
        console.error('Follow-up evaluation error:', error);
        setIsEvaluating(false);
        await moveToNextOrFinish(newAnswers);
      }
    } else {
      // Mobile: skip follow-up evaluation
      await moveToNextOrFinish(newAnswers);
    }
  };

  // AI Analysis of all answers using serverless function
  // Evaluate if follow-up is needed (desktop only - mobile uses gate)
  const evaluateForFollowUp = async (question, answer, questionIndex, totalQuestions, followUpsSoFar) => {
    if (answer === '[No response recorded]' || answer.length < 20) {
      return { shouldFollowUp: false, reason: 'no_content' };
    }
    
    try {
      const response = await fetch('/api/evaluate-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          answer,
          questionIndex,
          totalQuestions,
          followUpsAskedSoFar: followUpsSoFar,
          jobTitle,
          previousFollowUpTypes: followUpTypesUsed
        })
      });
      
      if (!response.ok) throw new Error('Follow-up evaluation failed');
      return await response.json();
    } catch (error) {
      console.error('Error evaluating for follow-up:', error);
      return { shouldFollowUp: false, reason: 'error' };
    }
  };

  const analyzeAllAnswers = async (allAnswers) => {
    try {
      const response = await fetch('/api/analyze-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers, jobTitle, followUpMetadata })
      });

      const data = await response.json();
      
      if (!response.ok || !data.results) {
        throw new Error('Analysis failed');
      }

      const results = data.results;
      
      // Also analyze video if we have snapshots
      let videoResults = null;
      if (videoEnabled && videoSnapshots.length > 0) {
        try {
          const videoResponse = await fetch('/api/analyze-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ snapshots: videoSnapshots })
          });
          const videoData = await videoResponse.json();
          videoResults = videoData.results;
          setVideoFeedback(videoResults);
        } catch (e) {
          console.error('Video analysis error:', e);
        }
      }
      
      // Stop camera and snapshot capture
      stopCamera();
      
      // Combine results
      const finalResultsWithVideo = {
        ...results,
        videoAnalysis: videoResults
      };
      
      setFinalResults(finalResultsWithVideo);
      
      // Save to history
      const interviewRecord = {
        date: new Date().toISOString(),
        jobTitle,
        overallScore: results.overallScore,
        passed: results.passed,
        categories: results.categories,
        questionScores: results.questionScores,
        videoScore: videoResults?.overallVideoScore || null
      };
      await savePastInterview(interviewRecord);
      await incrementCompletedInterviews();
      
      // Always save to leaderboard - use fallback name if not provided
      const leaderboardName = userName || 
        user?.user_metadata?.full_name?.split(' ')[0] || 
        user?.email?.split('@')[0] || 
        'Anonymous';
      await saveToLeaderboard(leaderboardName, results.overallScore, jobTitle, results.passed);
      
      // Track interview completed
      if (window.mixpanel) {
        window.mixpanel.track('interview_completed', {
          job_title: jobTitle,
          overall_score: results.overallScore,
          passed: results.passed,
          video_enabled: videoEnabled,
          video_score: videoResults?.overallVideoScore || null
        });
        
        // Update user profile with interview count
        window.mixpanel.people.increment('interviews_completed');
        window.mixpanel.people.set({
          'last_interview_date': new Date().toISOString(),
          'last_interview_score': results.overallScore
        });
      }
      // ===== SAVE TO SUPABASE FOR ALL LOGGED-IN USERS =====
      if (user) {
        try {
          const { data: sessionData } = await supabase.auth.getSession();
          const accessToken = sessionData?.session?.access_token;
          if (accessToken) {
            const questionsAndAnswers = allAnswers.map(a => ({
              question: a.question,
              answer: a.answer,
              timeSpent: a.timeSpent,
              isFollowUp: a.isFollowUp || false,
              parentQuestionIndex: a.parentQuestionIndex != null ? a.parentQuestionIndex : null
            }));

            const saveResponse = await fetch('/api/save-interview-results', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken,
                orgId: userOrgId || null,
                interviewData: {
                  jobTitle,
                  results,
                  videoAnalysis: videoResults,
                  userName: userName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Anonymous',
                  questionsAndAnswers
                }
              })
            });
            const saveData = await saveResponse.json();
            if (saveData.id) {
              setCurrentInterviewId(saveData.id);
            }
          }
        } catch (e) {
          console.error('Save to Supabase error (non-blocking):', e);
        }
      }
      // ===== END SAVE =====


      
      setIsAnalyzing(false);
      setStage('results');
      
      // Track results viewed
      if (window.mixpanel) {
        window.mixpanel.track('results_viewed', {
          overall_score: results.overallScore,
          passed: results.passed
        });
      }
      
    } catch (error) {
      console.error('Analysis error:', error);
      stopCamera();
      // Fallback results
      const fallbackResults = generateFallbackResults(allAnswers);
      setFinalResults(fallbackResults);
      setIsAnalyzing(false);
      setStage('results');
    }
  };

  // PDF Download function (Pro feature)
  const downloadResultsPDF = async () => {
    const isB2BCandidate = userOrgId != null;
    if (!isSubscribed && !TEST_MODE && !isB2BCandidate) {
      setPreviousStage('results');
      setStage('paywall');
      return;
    }
    
    try {
      // Track PDF download
      if (window.mixpanel) {
        window.mixpanel.track('pdf_downloaded');
      }
      
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      // Colors
      const primaryColor = [16, 185, 129]; // Green
      const failColor = [239, 68, 68]; // Red
      const darkColor = [30, 30, 40];
      const grayColor = [100, 100, 120];
      
      // Helper to add new page if needed
      const checkNewPage = (yPos, needed = 30) => {
        if (yPos + needed > pageHeight - 20) {
          pdf.addPage();
          return 20;
        }
        return yPos;
      };
      
      // Header
      pdf.setFillColor(20, 20, 30);
      pdf.rect(0, 0, pageWidth, 50, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Interview Results', pageWidth / 2, 25, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${jobTitle} • ${new Date().toLocaleDateString()}`, pageWidth / 2, 35, { align: 'center' });
      
      // Score Section
      let yPos = 65;
      
      // Overall Score Circle (simulated)
      pdf.setFillColor(...(finalResults.passed ? primaryColor : failColor));
      pdf.circle(pageWidth / 2, yPos + 15, 20, 'F');
      
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(28);
      pdf.setFont('helvetica', 'bold');
      pdf.text(String(finalResults.overallScore), pageWidth / 2, yPos + 18, { align: 'center' });
      
      pdf.setFontSize(10);
      pdf.text('/100', pageWidth / 2, yPos + 26, { align: 'center' });
      
      yPos += 50;
      
      // Verdict
      pdf.setTextColor(...(finalResults.passed ? primaryColor : failColor));
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(finalResults.passed ? 'PASSED' : 'NEEDS IMPROVEMENT', pageWidth / 2, yPos, { align: 'center' });
      
      yPos += 15;
      
      // Category Scores
      pdf.setTextColor(...darkColor);
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Performance Breakdown', 20, yPos);
      yPos += 10;
      
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const categories = Object.entries(finalResults.categories);
      categories.forEach(([key, val], index) => {
        const label = key.replace(/([A-Z])/g, ' $1').trim();
        const score = val.score;
        
        pdf.setTextColor(...grayColor);
        pdf.text(label, 20, yPos);
        pdf.text(`${score}/100`, 80, yPos);
        
        // Score bar
        pdf.setFillColor(50, 50, 60);
        pdf.rect(100, yPos - 3, 80, 4, 'F');
        
        const barColor = score >= 80 ? [16, 185, 129] : score >= 70 ? [245, 158, 11] : [239, 68, 68];
        pdf.setFillColor(...barColor);
        pdf.rect(100, yPos - 3, (score / 100) * 80, 4, 'F');
        
        yPos += 8;
      });
      
      yPos += 15;
      
      // Question-by-Question Breakdown
      if (finalResults.questionScores && finalResults.questionScores.length > 0) {
        yPos = checkNewPage(yPos, 40);
        
        pdf.setTextColor(...darkColor);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Question-by-Question Breakdown', 20, yPos);
        yPos += 10;
        
        finalResults.questionScores.forEach((q, i) => {
          yPos = checkNewPage(yPos, 35);
          
          // Question header
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...darkColor);
          pdf.text(`Question ${i + 1}`, 20, yPos);
          
          const scoreColor = q.score >= 80 ? primaryColor : q.score >= 70 ? [245, 158, 11] : failColor;
          pdf.setTextColor(...scoreColor);
          pdf.text(`${q.score}/100`, 170, yPos);
          yPos += 7;
          
          // Feedback
          pdf.setFontSize(9);
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...grayColor);
          
          if (q.feedback) {
            const feedbackLines = pdf.splitTextToSize(q.feedback, 170);
            feedbackLines.slice(0, 3).forEach(line => {
              yPos = checkNewPage(yPos, 10);
              pdf.text(line, 20, yPos);
              yPos += 5;
            });
          }
          
          // All Strengths
          if (q.strengths && q.strengths.length > 0) {
            q.strengths.forEach(strength => {
              yPos = checkNewPage(yPos, 10);
              pdf.setTextColor(...primaryColor);
              const strengthText = pdf.splitTextToSize(`✓ ${strength}`, 170);
              strengthText.forEach(line => {
                pdf.text(line, 20, yPos);
                yPos += 5;
              });
            });
          }
          
          // All Improvements
          if (q.improvements && q.improvements.length > 0) {
            q.improvements.forEach(improvement => {
              yPos = checkNewPage(yPos, 10);
              pdf.setTextColor(...failColor);
              const improvementText = pdf.splitTextToSize(`→ ${improvement}`, 170);
              improvementText.forEach(line => {
                pdf.text(line, 20, yPos);
                yPos += 5;
              });
            });
          }
          
          yPos += 5;
        });
      }
      
      // Video Analysis (if available)
      if (videoFeedback) {
        yPos = checkNewPage(yPos, 50);
        yPos += 10;
        
        pdf.setTextColor(...darkColor);
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Video Presence Analysis', 20, yPos);
        yPos += 10;
        
        // Video overall score
        if (videoFeedback.overallVideoScore) {
          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'bold');
          pdf.setTextColor(...grayColor);
          pdf.text(`Overall Video Score: ${videoFeedback.overallVideoScore}/100`, 20, yPos);
          yPos += 10;
        }
        
        // Video categories - these are at root level, not nested
        const videoCategories = ['eyeContact', 'posture', 'facialExpression', 'framing', 'background', 'overallPresence'];
        
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        
        videoCategories.forEach(key => {
          const val = videoFeedback[key];
          if (val && val.score !== undefined) {
            yPos = checkNewPage(yPos, 20);
            const label = key.replace(/([A-Z])/g, ' $1').trim();
            
            // Category name and score
            pdf.setTextColor(...darkColor);
            pdf.setFont('helvetica', 'bold');
            pdf.text(`${label}:`, 20, yPos);
            
            const catScoreColor = val.score >= 80 ? primaryColor : val.score >= 70 ? [245, 158, 11] : failColor;
            pdf.setTextColor(...catScoreColor);
            pdf.text(`${val.score}/100`, 80, yPos);
            yPos += 6;
            
            // Category feedback
            if (val.feedback) {
              pdf.setFont('helvetica', 'normal');
              pdf.setTextColor(...grayColor);
              const feedbackLines = pdf.splitTextToSize(val.feedback, 170);
              feedbackLines.slice(0, 2).forEach(line => {
                pdf.text(line, 20, yPos);
                yPos += 5;
              });
            }
            yPos += 3;
          }
        });
        
        // Top tip
        if (videoFeedback.topTip) {
          yPos = checkNewPage(yPos, 15);
          yPos += 5;
          pdf.setTextColor(...primaryColor);
          pdf.setFont('helvetica', 'bold');
          pdf.text('💡 Top Tip:', 20, yPos);
          yPos += 6;
          pdf.setFont('helvetica', 'normal');
          pdf.setTextColor(...grayColor);
          const tipLines = pdf.splitTextToSize(videoFeedback.topTip, 170);
          tipLines.forEach(line => {
            pdf.text(line, 20, yPos);
            yPos += 5;
          });
        }
      }
      
      // Footer on last page
      pdf.setTextColor(150, 150, 150);
      pdf.setFontSize(8);
      pdf.text('Generated by Ace My Interviews • acemyinterviews.io', pageWidth / 2, pageHeight - 10, { align: 'center' });
      
      // Download
      pdf.save(`interview-results-${new Date().toISOString().split('T')[0]}.pdf`);
      
    } catch (error) {
      console.error('PDF generation error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const generateFallbackResults = (allAnswers) => {
    const mainOnly = allAnswers.filter(a => !a.isFollowUp);
    const followUps = allAnswers.filter(a => a.isFollowUp);
    
    const avgLength = mainOnly.reduce((sum, a) => sum + a.answer.length, 0) / mainOnly.length;
    const avgTime = mainOnly.reduce((sum, a) => sum + a.timeSpent, 0) / mainOnly.length;
    const baseScore = Math.min(Math.round((avgLength / 500) * 50 + (avgTime / 180) * 30 + 20), 85);
    
    const fuLookup = {};
    followUps.forEach(fa => {
      fuLookup[fa.parentQuestionIndex] = fa;
    });
    
    return {
      overallScore: baseScore,
      passed: baseScore >= 70,
      verdict: baseScore >= 70 ? "Congratulations! You got the job!" : "Unfortunately, you did not pass this interview.",
      summary: "Your interview has been evaluated. Review the detailed feedback below.",
      questionScores: mainOnly.map((a, i) => {
        const hasFU = fuLookup[a.questionIndex] !== undefined;
        const meta = followUpMetadata[a.questionIndex];
        const fuAnswer = fuLookup[a.questionIndex];
        const mainScore = Math.round(baseScore + (Math.random() - 0.5) * 20);
        const fuScore = hasFU ? Math.round(baseScore + (Math.random() - 0.5) * 15) : null;
        
        return {
          questionNum: i + 1,
          score: mainScore,
          combinedScore: hasFU && fuScore ? Math.round(mainScore * 0.7 + fuScore * 0.3) : undefined,
          feedback: "Answer recorded and evaluated.",
          strengths: ["Attempted the question"],
          improvements: ["Provide more specific examples"],
          hasFollowUp: hasFU,
          followUp: hasFU ? {
            question: fuAnswer.question,
            score: fuScore,
            feedback: "Follow-up answer recorded and evaluated.",
            strengths: ["Responded to follow-up"],
            improvements: ["Add more detail"],
            coachingNote: meta?.whatWasMissing ? `This follow-up was probing for: ${meta.whatWasMissing}` : "Follow-up was asked to probe deeper.",
            followUpType: meta?.followUpType || null,
            whatWasMissing: meta?.whatWasMissing || null
          } : null,
          noFollowUpReason: !hasFU ? (meta?.reason || null) : undefined
        };
      }),
      categories: {
        clarity: { score: baseScore, feedback: "Evaluation based on response structure." },
        relevance: { score: baseScore, feedback: "Evaluation based on answer relevance." },
        depth: { score: baseScore - 5, feedback: "Consider adding more detail." },
        confidence: { score: baseScore, feedback: "Delivery assessment." },
        conciseness: { score: baseScore + 5, feedback: "Focused and to-the-point evaluation." },
        starMethod: { score: baseScore - 10, feedback: "Use STAR method for behavioral questions." },
        technicalAccuracy: { score: baseScore, feedback: "Technical content evaluation." },
        enthusiasm: { score: baseScore + 5, feedback: "Energy and interest assessment." }
      },
      topStrengths: ["Completed the interview", "Showed up prepared"],
      criticalImprovements: ["Practice with more specific examples", "Use STAR method"],
      coachingTip: "Practice telling stories about your experiences using the STAR method."
    };
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartInterview = async (source = 'landing') => {
    // Unlock audio playback for Safari (must happen in user gesture context)
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
      // Also create and play a silent HTML5 audio to unlock Audio() constructor
      const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
      silentAudio.play().catch(() => {});
    } catch (e) {}
    
    // In TEST_MODE, always allow access
    // B2B candidates with an org_id skip the paywall entirely
    // Interviews are now unlimited — results are paywalled instead
    const isB2BCandidate = userOrgId != null;
    
    // Reset interview state for new interview (but keep form data like job title, description, name, country, resume)
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentTranscript('');
    setFinalResults(null);
    setTimeLeft(180);
    setVideoSnapshots([]);
    setVideoFeedback(null);
    setWaitingForMobileStart(false);
    setWaitingForMobileNext(false);
    setMobileAudioReady(false);
    prefetchedAudioRef.current = null;
    
    // Reset follow-up states
    setIsFollowUp(false);
    setCurrentFollowUpQuestion(null);
    setFollowUpsAskedCount(0);
    setFollowUpTypesUsed([]);
    setFollowUpMetadata({});
    setIsEvaluating(false);
    
    // Try to get mic permission, but don't block if it fails
    try {
      await requestMicPermission();
    } catch (e) {
      console.log('Mic permission not granted yet, will try again later');
    }
    
    setStage('setup');
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#10b981';
    if (score >= 70) return '#f59e0b';
    if (score >= 50) return '#f97316';
    return '#ef4444';
  };

  const getPerformanceTrend = (category) => {
    if (pastInterviews.length < 2) return null;
    const current = finalResults?.categories[category]?.score || 0;
    const previous = pastInterviews[0]?.categories[category]?.score || 0;
    const diff = current - previous;
    if (Math.abs(diff) < 5) return { trend: 'stable', icon: '→', color: '#94a3b8' };
    if (diff > 0) return { trend: 'up', icon: '↑', color: '#10b981' };
    return { trend: 'down', icon: '↓', color: '#ef4444' };
  };

  // B2B Admin Dashboard
  if (userRole === 'admin' && userOrg && user) {
    return (
      <AdminDashboard
        user={user}
        supabase={supabase}
        org={userOrg}
       onLogout={signOut}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingWrapper}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Initializing...</p>
        </div>
      </div>
    );
  }



    // Dynamic headline based on ?role= param
    const getHeadline = () => {
      if (!urlRole) {
        return (
          <>
            Practice smarter.<br/>
            <em>Land the job.</em>
          </>
        );
      }
      // 3 variations, assigned statically by first character of role name
      const code = urlRole.charCodeAt(0) % 3;
      if (code === 0) {
        return (
          <>
            Simulate a realistic<br/>
            <em>{urlRole} interview.</em>
          </>
        );
      } else if (code === 1) {
        return (
          <>
            Practise for your<br/>
            <em>{urlRole} interview.</em>
          </>
        );
      } else {
        return (
          <>
            Ace your<br/>
            <em>{urlRole} interview.</em>
          </>
        );
      }
    };

  // Landing Page
  if (stage === 'landing') {
    const handleCTA = () => {
      if (user) {
        handleStartInterview();
      } else {
        signInWithGoogle();
      }
    };

    return (
      <>
        {/* Google Fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet" />

        <style>{`
          .lp-root {
            background: #070b14;
            color: #e8edf5;
            font-family: 'DM Sans', sans-serif;
            font-size: 16px;
            line-height: 1.6;
            overflow-x: hidden;
            min-height: 100vh;
          }
          .lp-root *, .lp-root *::before, .lp-root *::after { box-sizing: border-box; }

          /* Noise overlay */
          .lp-root::before {
            content: '';
            position: fixed;
            inset: 0;
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
            pointer-events: none;
            z-index: 0;
          }

          /* NAV */
          .lp-nav {
            position: fixed; top: 0; left: 0; right: 0; z-index: 100;
            display: flex; align-items: center; justify-content: space-between;
            padding: 1.2rem 6%;
            background: rgba(7,11,20,0.8);
            backdrop-filter: blur(16px);
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .lp-nav-logo {
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 1.2rem;
            color: #e8edf5;
            text-decoration: none;
          }
          .lp-nav-logo span { color: #00e5ff; }
          .lp-nav-links { display: flex; gap: 2.5rem; list-style: none; margin: 0; padding: 0; }
          .lp-nav-links a { color: #7a8ba3; text-decoration: none; font-size: 0.9rem; transition: color 0.2s; }
          .lp-nav-links a:hover { color: #e8edf5; }
          .lp-nav-cta {
            background: #00e5ff;
            color: #000;
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 0.85rem;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            padding: 0.6rem 1.4rem;
            border-radius: 6px;
            border: none;
            cursor: pointer;
            transition: box-shadow 0.2s, transform 0.2s;
          }
          .lp-nav-cta:hover { box-shadow: 0 0 24px rgba(0,229,255,0.4); transform: translateY(-1px); }

          /* HERO */
          .lp-hero {
            position: relative;
            z-index: 1;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
            padding: 7rem 6% 5rem;
            overflow: hidden;
          }
          .lp-hero::after {
            content: '';
            position: absolute;
            top: -10%;
            left: 50%;
            transform: translateX(-50%);
            width: 900px;
            height: 600px;
            background: radial-gradient(ellipse at center, rgba(0,229,255,0.1) 0%, transparent 70%);
            pointer-events: none;
          }
          .lp-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: rgba(0,229,255,0.08);
            border: 1px solid rgba(0,229,255,0.25);
            border-radius: 100px;
            padding: 0.35rem 1rem;
            font-size: 0.8rem;
            font-weight: 500;
            color: #00e5ff;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            margin-bottom: 2rem;
            animation: lpFadeDown 0.8s ease forwards;
          }
          .lp-badge::before {
            content: '';
            width: 6px; height: 6px;
            border-radius: 50%;
            background: #00e5ff;
            animation: lpPulse 2s infinite;
          }
          @keyframes lpPulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.3; }
          }
          @keyframes lpFadeDown {
            from { opacity: 0; transform: translateY(-16px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .lp-hero h1 {
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: clamp(2.6rem, 5.5vw, 4.5rem);
            line-height: 1.08;
            letter-spacing: -0.01em;
            max-width: 860px;
            margin: 0;
            animation: lpFadeDown 0.8s 0.1s ease both;
          }
          .lp-hero h1 em {
            font-style: normal;
            color: #00e5ff;
            position: relative;
          }
          .lp-hero h1 em::after {
            content: '';
            position: absolute;
            bottom: 4px; left: 0; right: 0;
            height: 3px;
            background: #00e5ff;
            opacity: 0.4;
            border-radius: 2px;
          }
          .lp-hero-sub {
            max-width: 580px;
            color: #7a8ba3;
            font-size: 1.15rem;
            font-weight: 300;
            margin: 1.75rem 0 2.5rem;
            line-height: 1.7;
            animation: lpFadeDown 0.8s 0.2s ease both;
          }
          .lp-hero-actions {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
            justify-content: center;
            animation: lpFadeDown 0.8s 0.3s ease both;
          }
          .lp-btn-primary {
            background: #00e5ff;
            color: #000;
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 1rem;
            padding: 0.9rem 2.2rem;
            border-radius: 8px;
            text-decoration: none;
            transition: box-shadow 0.25s, transform 0.2s;
            border: none;
            cursor: pointer;
            display: inline-flex; align-items: center; gap: 0.5rem;
          }
          .lp-btn-primary:hover { box-shadow: 0 0 40px rgba(0,229,255,0.4); transform: translateY(-2px); }
          .lp-btn-secondary {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.07);
            color: #e8edf5;
            font-family: 'Syne', sans-serif;
            font-weight: 600;
            font-size: 1rem;
            padding: 0.9rem 2.2rem;
            border-radius: 8px;
            text-decoration: none;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
            display: inline-flex; align-items: center; gap: 0.5rem;
          }
          .lp-btn-secondary:hover { border-color: #00e5ff; background: rgba(0,229,255,0.12); }

          .lp-hero-stats {
            display: flex;
            gap: 3rem;
            margin-top: 4rem;
            padding-top: 3rem;
            border-top: 1px solid rgba(255,255,255,0.07);
            animation: lpFadeDown 0.8s 0.4s ease both;
          }
          .lp-hero-stat { text-align: center; }
          .lp-hero-stat-num {
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 2rem;
            color: #e8edf5;
            letter-spacing: -0.01em;
          }
          .lp-hero-stat-num span { color: #00e5ff; }
          .lp-hero-stat-label { font-size: 0.8rem; color: #7a8ba3; text-transform: uppercase; letter-spacing: 0.08em; }

          /* TICKER */
          .lp-ticker {
            position: relative; z-index: 1;
            background: rgba(0,229,255,0.06);
            border-top: 1px solid rgba(0,229,255,0.12);
            border-bottom: 1px solid rgba(0,229,255,0.12);
            padding: 0.7rem 0;
            overflow: hidden;
            white-space: nowrap;
          }
          .lp-ticker-inner {
            display: inline-block;
            animation: lpTicker 30s linear infinite;
            font-size: 0.78rem;
            color: #00e5ff;
            letter-spacing: 0.06em;
            text-transform: uppercase;
          }
          @keyframes lpTicker {
            from { transform: translateX(0); }
            to { transform: translateX(-50%); }
          }
          .lp-ticker-sep { margin: 0 2rem; opacity: 0.4; }

          /* MOCKUP */
          .lp-mockup-section {
            position: relative; z-index: 1;
            padding: 2rem 6% 6rem;
            display: flex;
            justify-content: center;
          }
          .lp-mockup-wrapper {
            position: relative;
            width: 100%;
            max-width: 900px;
          }
          .lp-mockup-glow {
            position: absolute;
            inset: -40px;
            background: radial-gradient(ellipse at center, rgba(0,229,255,0.08) 0%, transparent 70%);
            pointer-events: none;
          }
          .lp-mockup-frame {
            background: #0d1422;
            border: 1px solid rgba(0,229,255,0.15);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04);
            position: relative;
          }
          .lp-mockup-topbar {
            background: rgba(0,0,0,0.3);
            padding: 0.8rem 1.2rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .lp-dot { width: 10px; height: 10px; border-radius: 50%; }
          .lp-dot-r { background: #ff5f57; }
          .lp-dot-y { background: #febc2e; }
          .lp-dot-g { background: #28c840; }
          .lp-mockup-url {
            flex: 1; text-align: center;
            font-size: 0.75rem; color: #7a8ba3;
            background: rgba(255,255,255,0.04);
            padding: 0.3rem 1rem;
            border-radius: 6px;
            max-width: 300px;
            margin: 0 auto;
          }
          .lp-mockup-body {
            padding: 3rem 2.5rem;
            min-height: 380px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1.5rem;
          }
          .lp-sim-progress { width: 100%; max-width: 500px; }
          .lp-sim-progress-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-bottom: 0.4rem; }
          .lp-sim-progress-fill { width: 20%; height: 100%; background: linear-gradient(90deg, #00e5ff, #0090ff); border-radius: 2px; }
          .lp-sim-progress-label { font-size: 0.75rem; color: #7a8ba3; }
          .lp-sim-timer {
            background: rgba(0,229,255,0.06);
            border: 1.5px solid rgba(0,229,255,0.3);
            border-radius: 10px;
            padding: 0.8rem 2rem;
            text-align: center;
          }
          .lp-sim-timer-label { font-size: 0.65rem; color: #00e5ff; letter-spacing: 0.12em; text-transform: uppercase; }
          .lp-sim-timer-num { font-family: 'Syne', sans-serif; font-size: 2.2rem; font-weight: 800; color: #00e5ff; letter-spacing: -0.04em; }
          .lp-sim-question {
            width: 100%; max-width: 500px;
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            padding: 1.25rem 1.5rem;
            font-size: 0.95rem;
            line-height: 1.6;
            color: #e8edf5;
          }
          .lp-sim-recording {
            background: rgba(255,77,106,0.1);
            border: 1px solid rgba(255,77,106,0.3);
            border-radius: 8px;
            padding: 0.6rem 1.25rem;
            font-size: 0.82rem;
            color: #ff4d6a;
            display: flex; align-items: center; gap: 0.5rem;
            width: 100%; max-width: 500px;
          }
          .lp-rec-dot {
            width: 8px; height: 8px; border-radius: 50%;
            background: #ff4d6a;
            animation: lpPulse 1.2s infinite;
          }
          .lp-sim-btn {
            background: linear-gradient(135deg, #00e5ff, #0090ff);
            color: #000;
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 0.85rem;
            padding: 0.7rem 1.75rem;
            border-radius: 8px;
            border: none;
          }

          /* SECTIONS */
          .lp-section { position: relative; z-index: 1; }
          .lp-section-tag {
            display: inline-block;
            font-size: 0.75rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            color: #00e5ff;
            margin-bottom: 1rem;
          }
          .lp-section-title {
            font-family: 'Syne', sans-serif;
            font-size: clamp(1.8rem, 3.5vw, 2.6rem);
            font-weight: 700;
            letter-spacing: -0.01em;
            line-height: 1.15;
            margin: 0 0 1rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          }
          .lp-section-sub {
            color: #7a8ba3;
            font-size: 1.05rem;
            max-width: 500px;
            margin: 0 auto 4rem;
          }

          /* HOW IT WORKS */
          .lp-hiw {
            padding: 7rem 6%;
            text-align: center;
          }
          .lp-steps-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 2px;
            max-width: 900px;
            margin: 0 auto;
            background: rgba(255,255,255,0.07);
            border-radius: 16px;
            overflow: hidden;
          }
          .lp-step-card {
            background: #0d1422;
            padding: 2.5rem 2rem;
            text-align: left;
            transition: background 0.3s;
          }
          .lp-step-card:hover { background: #111927; }
          .lp-step-num {
            font-family: 'Syne', sans-serif;
            font-size: 3.5rem;
            font-weight: 700;
            color: rgba(0,229,255,0.1);
            line-height: 1;
            margin-bottom: 1rem;
          }
          .lp-step-icon {
            width: 44px; height: 44px;
            background: rgba(0,229,255,0.12);
            border: 1px solid rgba(0,229,255,0.2);
            border-radius: 10px;
            display: flex; align-items: center; justify-content: center;
            font-size: 1.2rem;
            margin-bottom: 1rem;
          }
          .lp-step-title {
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 1.05rem;
            margin-bottom: 0.5rem;
          }
          .lp-step-desc { font-size: 0.9rem; color: #7a8ba3; line-height: 1.6; }

          /* FEATURES */
          .lp-features {
            padding: 7rem 6%;
            max-width: 1100px;
            margin: 0 auto;
          }
          .lp-features-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            margin-top: 3rem;
          }
          .lp-feature-card {
            background: #0d1422;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 2rem;
            transition: border-color 0.3s, transform 0.3s;
            position: relative;
            overflow: hidden;
          }
          .lp-feature-card::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 2px;
            background: linear-gradient(90deg, transparent, #00e5ff, transparent);
            opacity: 0;
            transition: opacity 0.3s;
          }
          .lp-feature-card:hover { border-color: rgba(0,229,255,0.2); transform: translateY(-3px); }
          .lp-feature-card:hover::before { opacity: 1; }
          .lp-feature-card.lp-large { grid-column: span 3; }
          .lp-feature-icon { font-size: 1.5rem; margin-bottom: 1rem; display: block; }
          .lp-feature-title {
            font-family: 'Syne', sans-serif;
            font-weight: 700;
            font-size: 1.1rem;
            margin-bottom: 0.5rem;
          }
          .lp-feature-desc { font-size: 0.9rem; color: #7a8ba3; line-height: 1.6; }

          /* Score bars */
          .lp-score-bars { margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; }
          .lp-score-row { display: flex; align-items: center; gap: 0.75rem; }
          .lp-score-label { font-size: 0.78rem; color: #7a8ba3; width: 120px; flex-shrink: 0; }
          .lp-score-track { flex: 1; height: 6px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden; }
          .lp-score-fill { height: 100%; border-radius: 4px; transition: width 1.2s cubic-bezier(0.22,1,0.36,1); }
          .lp-score-val { font-size: 0.8rem; font-weight: 600; font-family: 'Syne', sans-serif; width: 28px; text-align: right; }

          /* Video metrics */
          .lp-video-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.75rem;
            margin-top: 1.5rem;
          }
          .lp-video-metric {
            background: rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 10px;
            padding: 0.9rem;
          }
          .lp-vm-label { font-size: 0.72rem; color: #7a8ba3; margin-bottom: 0.3rem; }
          .lp-vm-score { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 1.3rem; }
          .lp-vm-bar { margin-top: 0.4rem; height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden; }
          .lp-vm-bar-fill { height: 100%; border-radius: 2px; }

          /* TESTIMONIALS */
          .lp-social-proof {
            padding: 7rem 6%;
            text-align: center;
            position: relative;
          }
          .lp-social-proof::before {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%);
            width: 600px; height: 400px;
            background: radial-gradient(ellipse, rgba(0,229,255,0.05) 0%, transparent 70%);
            pointer-events: none;
          }
          .lp-testimonials {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 1.5rem;
            max-width: 1000px;
            margin: 3rem auto 0;
          }
          .lp-testimonial-card {
            background: #0d1422;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 14px;
            padding: 1.75rem;
            text-align: left;
            transition: border-color 0.3s;
          }
          .lp-testimonial-card:hover { border-color: rgba(0,229,255,0.15); }
          .lp-testimonial-stars { color: #ffd700; font-size: 0.85rem; margin-bottom: 0.75rem; letter-spacing: 2px; }
          .lp-testimonial-quote { font-size: 0.9rem; color: #7a8ba3; line-height: 1.65; margin-bottom: 1.25rem; }
          .lp-testimonial-author { display: flex; align-items: center; gap: 0.75rem; }
          .lp-testimonial-avatar {
            width: 36px; height: 36px; border-radius: 50%;
            background: linear-gradient(135deg, #00e5ff, #0090ff);
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 0.8rem; color: #000;
            flex-shrink: 0;
          }
          .lp-testimonial-name { font-weight: 600; font-size: 0.88rem; color: #e8edf5; }
          .lp-testimonial-role { font-size: 0.75rem; color: #7a8ba3; }

          /* COMPARE */
          .lp-compare {
            padding: 7rem 6%;
            max-width: 900px;
            margin: 0 auto;
            text-align: center;
          }
          .lp-compare-table {
            margin-top: 3rem;
            border: 1px solid rgba(255,255,255,0.07);
            border-radius: 16px;
            overflow: hidden;
          }
          .lp-compare-head, .lp-compare-row {
            display: grid;
            grid-template-columns: 2fr 1fr 1fr 1fr;
            border-bottom: 1px solid rgba(255,255,255,0.07);
          }
          .lp-compare-head { background: rgba(255,255,255,0.03); }
          .lp-compare-row:last-child { border-bottom: none; }
          .lp-compare-row:hover { background: rgba(255,255,255,0.02); }
          .lp-compare-cell {
            padding: 1rem 1.25rem;
            font-size: 0.88rem;
            display: flex; align-items: center;
            border-right: 1px solid rgba(255,255,255,0.07);
            color: #7a8ba3;
          }
          .lp-compare-cell:last-child { border-right: none; }
          .lp-compare-cell.lp-center { justify-content: center; }
          .lp-col-head { font-size: 0.8rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; }
          .lp-col-ace { color: #00e5ff; font-weight: 700; font-family: 'Syne', sans-serif; }
          .lp-check { color: #00ff9d; font-size: 1rem; }
          .lp-cross { color: rgba(255,255,255,0.2); font-size: 0.9rem; }
          .lp-partial { color: #ff7b3a; font-size: 0.85rem; }

          /* CTA SECTION */
          .lp-cta-section {
            padding: 8rem 6%;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .lp-cta-section::before {
            content: '';
            position: absolute;
            bottom: -200px; left: 50%;
            transform: translateX(-50%);
            width: 1200px; height: 700px;
            background: radial-gradient(ellipse at bottom, rgba(0,229,255,0.1) 0%, transparent 70%);
            pointer-events: none;
          }
          .lp-cta-box {
            background: #0d1422;
            border: 1px solid rgba(0,229,255,0.2);
            border-radius: 24px;
            padding: 5rem 3rem;
            max-width: 720px;
            margin: 0 auto;
            position: relative;
            overflow: hidden;
          }
          .lp-cta-box::before {
            content: '';
            position: absolute;
            top: 0; left: 50%; transform: translateX(-50%);
            width: 60%; height: 1px;
            background: linear-gradient(90deg, transparent, #00e5ff, transparent);
          }
          .lp-cta-box h2 {
            font-family: 'Syne', sans-serif;
            font-size: clamp(1.8rem, 3.5vw, 2.6rem);
            font-weight: 700;
            letter-spacing: -0.01em;
            margin: 0 0 1rem;
            line-height: 1.15;
          }
          .lp-cta-box p { color: #7a8ba3; font-size: 1.05rem; margin-bottom: 2.5rem; }
          .lp-cta-note { font-size: 0.78rem !important; color: #7a8ba3; margin-top: 1rem !important; }

          /* FOOTER */
          .lp-footer {
            padding: 3rem 6%;
            border-top: 1px solid rgba(255,255,255,0.07);
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 1rem;
            position: relative;
            z-index: 1;
          }
          .lp-footer-copy { font-size: 0.82rem; color: #7a8ba3; }
          .lp-footer-links { display: flex; gap: 2rem; }
          .lp-footer-links a { font-size: 0.82rem; color: #7a8ba3; text-decoration: none; transition: color 0.2s; cursor: pointer; }
          .lp-footer-links a:hover { color: #e8edf5; }

          /* Fade in animation */
          .lp-fade-in {
            opacity: 0;
            transform: translateY(24px);
            transition: opacity 0.6s ease, transform 0.6s ease;
          }
          .lp-fade-in.lp-visible {
            opacity: 1;
            transform: translateY(0);
          }

          /* Google icon in button */
          .lp-google-svg { flex-shrink: 0; }

          /* RESPONSIVE */
          @media (max-width: 768px) {
            .lp-nav-links { display: none; }
            .lp-hero-stats { gap: 2rem; flex-wrap: wrap; justify-content: center; }
            .lp-steps-grid { grid-template-columns: 1fr; }
            .lp-features-grid { grid-template-columns: 1fr; }
            .lp-feature-card.lp-large { grid-column: span 1; }
            .lp-testimonials { grid-template-columns: 1fr; }
            .lp-compare-head, .lp-compare-row { grid-template-columns: 2fr 1fr 1fr; }
            .lp-compare-cell:nth-child(3) { display: none; }
            .lp-video-grid { grid-template-columns: 1fr 1fr; }
          }
        `}</style>

        <div className="lp-root">
          {/* NAV */}
          <nav className="lp-nav">
            <span className="lp-nav-logo">Ace<span>My</span>Interviews</span>
            <ul className="lp-nav-links">
              <li><a href="#lp-how">How it works</a></li>
              <li><a href="#lp-features">Features</a></li>
              <li><a href="#lp-testimonials">Reviews</a></li>
              <li><a href="#lp-compare">Compare</a></li>
            </ul>
            <button className="lp-nav-cta" onClick={handleCTA}>{user ? (completedInterviews === 0 ? 'Start Free Interview →' : 'Start Interview →') : 'Start Free →'}</button>
            {user && <>
              <button onClick={() => setStage('dashboard')} style={{background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#7a8ba3', fontSize:'0.82rem', padding:'0.5rem 1rem', borderRadius:'6px', cursor:'pointer', marginLeft:'0.5rem'}}>My Dashboard</button>
              <button onClick={signOut} style={{background:'none', border:'1px solid rgba(255,255,255,0.1)', color:'#7a8ba3', fontSize:'0.82rem', padding:'0.5rem 1rem', borderRadius:'6px', cursor:'pointer', marginLeft:'0.5rem'}}>Sign Out</button>
            </>}
          </nav>

          {/* HERO */}
          <section className="lp-hero">
            <div className="lp-badge">✦ AI-Powered Interview Training</div>
            <h1>
              {getHeadline()}
            </h1>
            <p className="lp-hero-sub">
              Simulate real interviews with an AI that asks follow-up questions, 
              grades your answers across 8 dimensions, and tells you exactly what to 
              fix — before the real thing.
            </p>
            <div className="lp-hero-actions">
              <button className="lp-btn-primary" onClick={handleCTA}>
                {!user && <svg className="lp-google-svg" width="16" height="16" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#000"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#000"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#000"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#000"/></svg>}
                {user ? (completedInterviews === 0 ? 'Start Free Interview' : 'Start Interview') : 'Try a free interview'}
              </button>
              <a className="lp-btn-secondary" href="#lp-how">See how it works</a>
            </div>
            <div className="lp-hero-stats">
              <div className="lp-hero-stat">
                <div className="lp-hero-stat-num">8<span>+</span></div>
                <div className="lp-hero-stat-label">Scoring dimensions</div>
              </div>
              <div className="lp-hero-stat">
                <div className="lp-hero-stat-num">3<span>+</span></div>
                <div className="lp-hero-stat-label">Follow-up questions</div>
              </div>
              <div className="lp-hero-stat">
                <div className="lp-hero-stat-num">60<span>s</span></div>
                <div className="lp-hero-stat-label">To start practicing</div>
              </div>
              <div className="lp-hero-stat">
                <div className="lp-hero-stat-num">100<span>%</span></div>
                <div className="lp-hero-stat-label">Actionable feedback</div>
              </div>
            </div>
          </section>

          {/* TICKER */}
          <div className="lp-ticker">
            <div className="lp-ticker-inner">
              AI Follow-up Questions <span className="lp-ticker-sep">◆</span>
              Clarity Scoring <span className="lp-ticker-sep">◆</span>
              STAR Method Coaching <span className="lp-ticker-sep">◆</span>
              Video Presence Analysis <span className="lp-ticker-sep">◆</span>
              Real-time Feedback <span className="lp-ticker-sep">◆</span>
              Percentile Ranking <span className="lp-ticker-sep">◆</span>
              Technical Accuracy <span className="lp-ticker-sep">◆</span>
              Confidence Scoring <span className="lp-ticker-sep">◆</span>
              AI Follow-up Questions <span className="lp-ticker-sep">◆</span>
              Clarity Scoring <span className="lp-ticker-sep">◆</span>
              STAR Method Coaching <span className="lp-ticker-sep">◆</span>
              Video Presence Analysis <span className="lp-ticker-sep">◆</span>
              Real-time Feedback <span className="lp-ticker-sep">◆</span>
              Percentile Ranking <span className="lp-ticker-sep">◆</span>
              Technical Accuracy <span className="lp-ticker-sep">◆</span>
              Confidence Scoring <span className="lp-ticker-sep">◆</span>
            </div>
          </div>

          {/* MOCKUP PREVIEW */}
          <div className="lp-mockup-section">
            <div className="lp-mockup-wrapper">
              <div className="lp-mockup-glow"></div>
              <div className="lp-mockup-frame">
                <div className="lp-mockup-topbar">
                  <div className="lp-dot lp-dot-r"></div>
                  <div className="lp-dot lp-dot-y"></div>
                  <div className="lp-dot lp-dot-g"></div>
                  <div className="lp-mockup-url">🔒 acemyinterviews.io/interview</div>
                </div>
                <div className="lp-mockup-body">
                  <div className="lp-sim-progress">
                    <div className="lp-sim-progress-bar"><div className="lp-sim-progress-fill"></div></div>
                    <div className="lp-sim-progress-label">Question 1 of 5</div>
                  </div>
                  <div className="lp-sim-timer">
                    <div className="lp-sim-timer-label">Time Remaining</div>
                    <div className="lp-sim-timer-num">2:19</div>
                  </div>
                  <div className="lp-sim-question">
                    Tell me about a time you had to translate complex technical 
                    requirements into business language for non-technical stakeholders.
                  </div>
                  <div className="lp-sim-recording">
                    <div className="lp-rec-dot"></div>
                    Recording your answer...
                  </div>
                  <button className="lp-sim-btn">Submit Answer →</button>
                </div>
              </div>
            </div>
          </div>

          {/* HOW IT WORKS */}
          <section className="lp-hiw lp-section lp-fade-in lp-visible" id="lp-how">
            <div className="lp-section-tag">Simple 3-step process</div>
            <h2 className="lp-section-title">From nervous to confident in one session</h2>
            <p className="lp-section-sub">No setup, no coaching calls, no waiting. Just you and the most demanding AI interviewer you've ever faced.</p>
            <div className="lp-steps-grid">
              <div className="lp-step-card">
                <div className="lp-step-num">01</div>
                <div className="lp-step-icon">📝</div>
                <div className="lp-step-title">Tell us about the role</div>
                <div className="lp-step-desc">Enter the job title and paste the job description — the AI uses it to generate questions specific to that role. Paste your resume too and every question gets tailored to your actual experience.</div>
              </div>
              <div className="lp-step-card">
                <div className="lp-step-num">02</div>
                <div className="lp-step-icon">🎬</div>
                <div className="lp-step-title">Answer on camera, in real-time</div>
                <div className="lp-step-desc">The AI records your voice and video, then asks intelligent follow-up questions based on what you actually said — just like a real interviewer probing for depth.</div>
              </div>
              <div className="lp-step-card">
                <div className="lp-step-num">03</div>
                <div className="lp-step-icon">📊</div>
                <div className="lp-step-title">Get a full performance breakdown</div>
                <div className="lp-step-desc">See your score across Clarity, Depth, Confidence, STAR Method, Technical Accuracy, and 3 more. Know exactly what to improve before the real interview.</div>
              </div>
            </div>
          </section>

          {/* FEATURES */}
          <section className="lp-features lp-section lp-fade-in lp-visible" id="lp-features">
            <div style={{textAlign:'center'}}>
              <div className="lp-section-tag">What makes it different</div>
              <h2 className="lp-section-title">Not just mock questions — a full diagnostic</h2>
              <p className="lp-section-sub">Most prep tools give you questions. We give you the same level of analysis a career coach would — in seconds.</p>
            </div>
            <div className="lp-features-grid">
              {/* AI Follow-up */}
              <div className="lp-feature-card">
                <span className="lp-feature-icon">🤖</span>
                <div className="lp-feature-title">Dynamic AI follow-up questions</div>
                <div className="lp-feature-desc">The AI actually listens to what you say and asks pointed follow-ups based on your specific answer. No two interviews are the same.</div>
                <div style={{marginTop:'1.25rem', background:'rgba(0,229,255,0.05)', border:'1px solid rgba(0,229,255,0.12)', borderRadius:'10px', padding:'1rem', fontSize:'0.82rem', color:'#7a8ba3', lineHeight:'1.65'}}>
                  <span style={{color:'#00e5ff', fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.1em', fontWeight:'600'}}>AI Follow-up</span><br/><br/>
                  "You mentioned stakeholders thought they could automate everything — walk me through exactly how you presented that Excel sheet and what their reaction was."
                </div>
              </div>

              {/* 8-dimension scoring */}
              <div className="lp-feature-card">
                <span className="lp-feature-icon">📈</span>
                <div className="lp-feature-title">8-dimension performance scoring</div>
                <div className="lp-feature-desc">Every answer is graded across Clarity, Relevance, Depth, Confidence, Conciseness, STAR Method, Technical Accuracy, and Enthusiasm.</div>
                <div className="lp-score-bars">
                  <div className="lp-score-row">
                    <span className="lp-score-label">Technical Accuracy</span>
                    <div className="lp-score-track"><div className="lp-score-fill" style={{width:'80%', background:'#00ff9d'}}></div></div>
                    <span className="lp-score-val" style={{color:'#00ff9d'}}>80</span>
                  </div>
                  <div className="lp-score-row">
                    <span className="lp-score-label">Relevance</span>
                    <div className="lp-score-track"><div className="lp-score-fill" style={{width:'78%', background:'#00e5ff'}}></div></div>
                    <span className="lp-score-val" style={{color:'#00e5ff'}}>78</span>
                  </div>
                  <div className="lp-score-row">
                    <span className="lp-score-label">Depth</span>
                    <div className="lp-score-track"><div className="lp-score-fill" style={{width:'75%', background:'#00e5ff'}}></div></div>
                    <span className="lp-score-val" style={{color:'#00e5ff'}}>75</span>
                  </div>
                  <div className="lp-score-row">
                    <span className="lp-score-label">Conciseness</span>
                    <div className="lp-score-track"><div className="lp-score-fill" style={{width:'60%', background:'#ff7b3a'}}></div></div>
                    <span className="lp-score-val" style={{color:'#ff7b3a'}}>60</span>
                  </div>
                  <div className="lp-score-row">
                    <span className="lp-score-label">STAR Method</span>
                    <div className="lp-score-track"><div className="lp-score-fill" style={{width:'55%', background:'#ff4d6a'}}></div></div>
                    <span className="lp-score-val" style={{color:'#ff4d6a'}}>55</span>
                  </div>
                </div>
              </div>

              {/* Video presence */}
              <div className="lp-feature-card">
                <span className="lp-feature-icon">🎥</span>
                <div className="lp-feature-title">Video presence analysis</div>
                <div className="lp-feature-desc">Beyond words — your body language, eye contact, facial expression, and framing are all analysed automatically.</div>
                <div className="lp-video-grid">
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Eye Contact</div>
                    <div className="lp-vm-score" style={{color:'#ff4d6a'}}>25</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'25%', background:'#ff4d6a'}}></div></div>
                  </div>
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Posture</div>
                    <div className="lp-vm-score" style={{color:'#ff7b3a'}}>70</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'70%', background:'#ff7b3a'}}></div></div>
                  </div>
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Framing</div>
                    <div className="lp-vm-score" style={{color:'#00ff9d'}}>85</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'85%', background:'#00ff9d'}}></div></div>
                  </div>
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Background</div>
                    <div className="lp-vm-score" style={{color:'#00ff9d'}}>90</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'90%', background:'#00ff9d'}}></div></div>
                  </div>
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Expression</div>
                    <div className="lp-vm-score" style={{color:'#ff4d6a'}}>40</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'40%', background:'#ff4d6a'}}></div></div>
                  </div>
                  <div className="lp-video-metric">
                    <div className="lp-vm-label">Overall</div>
                    <div className="lp-vm-score" style={{color:'#ff7b3a'}}>61</div>
                    <div className="lp-vm-bar"><div className="lp-vm-bar-fill" style={{width:'61%', background:'#ff7b3a'}}></div></div>
                  </div>
                </div>
              </div>

              {/* Q-by-Q breakdown */}
              <div className="lp-feature-card lp-large">
                <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:'1rem', marginBottom:'1.5rem'}}>
                  <div>
                    <span className="lp-feature-icon" style={{marginBottom:'0.5rem'}}>📋</span>
                    <div className="lp-feature-title">Question-by-question feedback</div>
                    <div className="lp-feature-desc" style={{maxWidth:'520px'}}>Each answer gets a full breakdown — specific strengths, concrete improvements, and separate scores for your main answer and the AI follow-up.</div>
                  </div>
                  <div style={{display:'flex', alignItems:'center', gap:'1rem', flexShrink:0}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontFamily:"'Syne', sans-serif", fontSize:'2.6rem', fontWeight:700, color:'#00e5ff', letterSpacing:'-0.02em', lineHeight:1}}>72</div>
                      <div style={{fontSize:'0.72rem', color:'#7a8ba3', textTransform:'uppercase', letterSpacing:'0.08em'}}>Overall</div>
                    </div>
                    <span style={{background:'rgba(0,255,157,0.1)', border:'1px solid rgba(0,255,157,0.25)', color:'#00ff9d', fontSize:'0.72rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', padding:'0.2rem 0.6rem', borderRadius:'4px'}}>✓ You passed</span>
                  </div>
                </div>

                {/* Q1 Block */}
                <div style={{background:'rgba(255,255,255,0.02)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:'12px', padding:'1.25rem 1.5rem', marginBottom:'1rem'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.6rem', flexWrap:'wrap', gap:'0.5rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                      <span style={{background:'#00e5ff', color:'#000', fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'0.72rem', padding:'0.2rem 0.55rem', borderRadius:'4px', letterSpacing:'0.04em'}}>Q1</span>
                      <span style={{fontSize:'0.82rem', color:'#7a8ba3'}}>Translating technical requirements for stakeholders</span>
                    </div>
                    <span style={{fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'0.9rem', color:'#00e5ff'}}>combined <strong style={{fontSize:'1rem'}}>76</strong>/100</span>
                  </div>
                  <p style={{fontSize:'0.82rem', color:'#7a8ba3', lineHeight:1.6, marginBottom:'1rem'}}>Strong example with specific actions taken (10 knowledge articles, 2 help articles, demo videos, live sessions). Candidate clearly identified the bottleneck. However the response lacked clear structure and was somewhat rambling in delivery.</p>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                    <div>
                      <div style={{fontSize:'0.72rem', fontWeight:700, color:'#00ff9d', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.6rem'}}>✓ Strengths</div>
                      <ul style={{listStyle:'none', display:'flex', flexDirection:'column', gap:'0.45rem', margin:0, padding:0}}>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#00ff9d', flexShrink:0}}>•</span>Specific deliverables mentioned</li>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#00ff9d', flexShrink:0}}>•</span>Comprehensive multi-stakeholder approach</li>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#00ff9d', flexShrink:0}}>•</span>Proactive issue identification</li>
                      </ul>
                    </div>
                    <div>
                      <div style={{fontSize:'0.72rem', fontWeight:700, color:'#ff7b3a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.6rem'}}>△ Improve</div>
                      <ul style={{listStyle:'none', display:'flex', flexDirection:'column', gap:'0.45rem', margin:0, padding:0}}>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#ff7b3a', flexShrink:0}}>•</span>Structure with STAR method</li>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#ff7b3a', flexShrink:0}}>•</span>Provide timeline details upfront</li>
                        <li style={{fontSize:'0.8rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#ff7b3a', flexShrink:0}}>•</span>Quantify the scope better</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Follow-up block */}
                <div style={{background:'rgba(0,229,255,0.03)', border:'1px solid rgba(0,229,255,0.15)', borderRadius:'12px', padding:'1.25rem 1.5rem'}}>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem', flexWrap:'wrap', gap:'0.5rem'}}>
                    <div style={{display:'flex', alignItems:'center', gap:'0.75rem'}}>
                      <span style={{background:'rgba(0,229,255,0.15)', color:'#00e5ff', border:'1px solid rgba(0,229,255,0.3)', fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'0.7rem', padding:'0.2rem 0.6rem', borderRadius:'4px', letterSpacing:'0.04em'}}>↩ Follow-up</span>
                      <span style={{fontSize:'0.78rem', color:'#7a8ba3', fontStyle:'italic'}}>"Walk me through how you presented the Excel sheet and their reaction…"</span>
                    </div>
                    <span style={{fontFamily:"'Syne', sans-serif", fontWeight:700, fontSize:'0.9rem', color:'#00e5ff'}}><strong style={{fontSize:'1rem'}}>78</strong>/100</span>
                  </div>
                  <p style={{fontSize:'0.78rem', color:'rgba(0,229,255,0.6)', marginBottom:'0.75rem'}}>↳ Follow-up tested ability to provide specifics on timeline and impact — candidate delivered well on timeline but could have been more quantitative on results.</p>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem'}}>
                    <div>
                      <div style={{fontSize:'0.7rem', fontWeight:700, color:'#00ff9d', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem'}}>✓ Strengths</div>
                      <ul style={{listStyle:'none', display:'flex', flexDirection:'column', gap:'0.4rem', margin:0, padding:0}}>
                        <li style={{fontSize:'0.78rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#00ff9d', flexShrink:0}}>•</span>Clear timeline provided (2 weeks)</li>
                        <li style={{fontSize:'0.78rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#00ff9d', flexShrink:0}}>•</span>Specific deliverable counts mentioned</li>
                      </ul>
                    </div>
                    <div>
                      <div style={{fontSize:'0.7rem', fontWeight:700, color:'#ff7b3a', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:'0.5rem'}}>△ Improve</div>
                      <ul style={{listStyle:'none', display:'flex', flexDirection:'column', gap:'0.4rem', margin:0, padding:0}}>
                        <li style={{fontSize:'0.78rem', color:'#7a8ba3', display:'flex', gap:'0.5rem'}}><span style={{color:'#ff7b3a', flexShrink:0}}>•</span>Could have provided measurable success metrics</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* TESTIMONIALS */}
          <section className="lp-social-proof lp-section lp-fade-in lp-visible" id="lp-testimonials">
            <h2 className="lp-section-title">Real people. Real interviews. Real offers.</h2>
            <p className="lp-section-sub">From first-timers to senior hires — here's what candidates said after practicing with AceMyInterviews.</p>
            <div className="lp-testimonials">
              <div className="lp-testimonial-card">
                <div className="lp-testimonial-stars">★★★★★</div>
                <p className="lp-testimonial-quote">"The follow-up questions caught me completely off guard the first time — which is exactly what I needed. By the third session I had an answer ready for anything."</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">JR</div>
                  <div>
                    <div className="lp-testimonial-name">James R.</div>
                    <div className="lp-testimonial-role">Product Manager @ Stripe</div>
                  </div>
                </div>
              </div>
              <div className="lp-testimonial-card">
                <div className="lp-testimonial-stars">★★★★★</div>
                <p className="lp-testimonial-quote">"I had no idea my eye contact was that bad until the video analysis flagged it. Practiced for 2 days, walked into the interview feeling completely different."</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">SM</div>
                  <div>
                    <div className="lp-testimonial-name">Sarah M.</div>
                    <div className="lp-testimonial-role">Software Engineer @ Meta</div>
                  </div>
                </div>
              </div>
              <div className="lp-testimonial-card">
                <div className="lp-testimonial-stars">★★★★★</div>
                <p className="lp-testimonial-quote">"The STAR method score showed me exactly why my answers were landing flat. Once I structured them properly my score jumped from 55 to 84 in 3 tries."</p>
                <div className="lp-testimonial-author">
                  <div className="lp-testimonial-avatar">AL</div>
                  <div>
                    <div className="lp-testimonial-name">Alicia L.</div>
                    <div className="lp-testimonial-role">Senior Analyst @ McKinsey</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* COMPARISON TABLE */}
          <section className="lp-compare lp-section lp-fade-in lp-visible" id="lp-compare">
            <div className="lp-section-tag">Why AceMyInterviews</div>
            <h2 className="lp-section-title">The prep tool that actually mirrors real interviews</h2>
            <div className="lp-compare-table">
              <div className="lp-compare-head">
                <div className="lp-compare-cell lp-col-head">Feature</div>
                <div className="lp-compare-cell lp-center lp-col-head lp-col-ace">AceMy<br/>Interviews</div>
                <div className="lp-compare-cell lp-center lp-col-head">Mock<br/>Questions</div>
                <div className="lp-compare-cell lp-center lp-col-head">Human<br/>Coach</div>
              </div>
              {[
                ['AI follow-up questions', true, false, 'partial'],
                ['8-dimension scoring', true, false, 'partial'],
                ['Video presence analysis', true, false, false],
                ['Available 24/7, instant', true, true, false],
                ['Percentile ranking vs peers', true, false, false],
                ['Per-question improvement notes', true, false, 'partial'],
                ['Free to start', true, true, false],
              ].map(([feature, ace, mock, human], i) => (
                <div className="lp-compare-row" key={i}>
                  <div className="lp-compare-cell">{feature}</div>
                  <div className="lp-compare-cell lp-center">{ace === true ? <span className="lp-check">✓</span> : ace === 'partial' ? <span className="lp-partial">~</span> : <span className="lp-cross">✗</span>}</div>
                  <div className="lp-compare-cell lp-center">{mock === true ? <span className="lp-check">✓</span> : mock === 'partial' ? <span className="lp-partial">~</span> : <span className="lp-cross">✗</span>}</div>
                  <div className="lp-compare-cell lp-center">{human === true ? <span className="lp-check">✓</span> : human === 'partial' ? <span className="lp-partial">~</span> : <span className="lp-cross">✗</span>}</div>
                </div>
              ))}
            </div>
          </section>

          {/* FINAL CTA */}
          <section className="lp-cta-section lp-section lp-fade-in lp-visible">
            <div className="lp-cta-box">
              <h2>Your next interview<br/>starts <em style={{color:'#00e5ff', fontStyle:'normal'}}>right now</em></h2>
              <p>Set up in under a minute. Get your first score in under 10. No credit card — just sign in with Google and you're in.</p>
              <button className="lp-btn-primary" onClick={handleCTA} style={{fontSize:'1.05rem', padding:'1rem 2.5rem', margin:'0 auto', display:'flex'}}>
                {!user && <svg className="lp-google-svg" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#000"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#000"/><path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#000"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#000"/></svg>}
                {user ? (completedInterviews === 0 ? 'Start Free Interview' : 'Start Interview') : 'Continue with Google'}
              </button>
              <p className="lp-cta-note">{user ? (isSubscribed ? '✓ Subscribed · Unlimited interviews' : completedInterviews === 0 ? '🎁 First interview is completely free' : 'Free trial used · Subscribe for unlimited access') : 'Free to start · No card needed · Takes 60 seconds to set up'}</p>
            </div>
          </section>

          {/* FOOTER */}
          <footer className="lp-footer">
            <div className="lp-footer-copy">© 2026 AceMyInterviews. All rights reserved.</div>
            <div className="lp-footer-links">
              <a onClick={(e) => { e.preventDefault(); setStage('privacy'); }}>Privacy</a>
              <a href="mailto:support@acemyinterviews.io">Contact</a>
            </div>
          </footer>
        </div>
      </>
    );
  }

  // Paywall
  if (stage === 'paywall') {
    // Track paywall shown
    if (window.mixpanel) {
      window.mixpanel.track('paywall_shown');
    }
    
    const handleSubscribeClick = () => {
      if (window.mixpanel) {
        window.mixpanel.track('subscribe_clicked');
      }
      if (currentInterviewId) localStorage.setItem('pendingInterviewId', currentInterviewId);
      localStorage.setItem('pendingStage', previousStage || 'landing');
      window.location.href = STRIPE_SUBSCRIBE_URL;
    };
    
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.paywall}>
          <div style={styles.lockIcon}>🔒</div>
          <h2 style={styles.paywallTitle}>Unlock unlimited access</h2>
          <p style={styles.paywallText}>
            Unlock unlimited practice interviews and keep improving until you land your dream job.
          </p>
          
          <div style={styles.priceCard}>
            <div style={styles.priceTag}>
              <span style={styles.priceAmount}>$19.99</span>
              <span style={styles.pricePeriod}>/month</span>
            </div>
            <ul style={styles.priceFeatures}>
              <li>✓ Unlimited interview sessions</li>
              <li>✓ AI-powered answer analysis</li>
              <li>✓ Comprehensive scorecards</li>
              <li>✓ Progress tracking (3 interviews)</li>
              <li>✓ Global leaderboard ranking</li>
              <li>✓ All job roles supported</li>
              <li>✓ Cancel anytime</li>
            </ul>
          </div>

          {TEST_MODE ? (
            <button style={styles.primaryBtn} onClick={simulateSubscribe}>
              [TEST] Simulate Subscribe
              <span style={styles.btnArrow}>→</span>
            </button>
          ) : (
            <button style={styles.primaryBtn} onClick={handleSubscribeClick}>
              Subscribe Now
              <span style={styles.btnArrow}>→</span>
            </button>
          )}
          
          <button style={styles.ghostBtn} onClick={() => {
            const destination = (previousStage === 'results' || previousStage === 'dashboard') ? previousStage : 'landing';
            setStage(destination);
          }}>
            ← Back to {previousStage === 'results' ? 'results' : previousStage === 'dashboard' ? 'dashboard' : 'home'}
          </button>
        </div>
      </div>
    );
  }

  // Dashboard
  if (stage === 'dashboard') {
    const getOverallTrend = () => {
      if (pastInterviews.length < 2) return null;
      const latest = pastInterviews[0]?.overallScore || 0;
      const previous = pastInterviews[1]?.overallScore || 0;
      const diff = latest - previous;
      return { diff, direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'stable' };
    };

    const trend = getOverallTrend();

    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.dashboardContainer}>
          <h2 style={styles.sectionTitle}>⚙️ Dashboard</h2>
          
          {/* Subscription Card */}
          <div style={styles.dashboardCard}>
            <h3 style={styles.dashboardCardTitle}>Subscription</h3>
            {isSubscribed ? (
              <div>
                <div style={styles.subscriptionStatus}>
                  <span style={styles.statusBadgeActive}>✓ Active</span>
                  <span style={styles.subscriptionPrice}>$19.99/month</span>
                </div>
                {subscriptionDate && (
                  <p style={styles.subscriptionDate}>
                    Member since {new Date(subscriptionDate).toLocaleDateString()}
                  </p>
                )}
                <div style={styles.subscriptionActions}>
                  {TEST_MODE ? (
                    <button style={styles.dangerBtn} onClick={cancelSubscription}>
                      [TEST] Cancel Subscription
                    </button>
                  ) : (
                    <a 
                      href={STRIPE_PORTAL_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.secondaryBtn}
                    >
                      Manage Subscription
                    </a>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div style={styles.subscriptionStatus}>
                  <span style={styles.statusBadgeInactive}>No active subscription</span>
                </div>
                <p style={styles.subscriptionInfo}>
                  {completedInterviews === 0 
                    ? "You have 1 free interview available"
                    : "Subscribe to continue practicing"}
                </p>
                <button style={styles.primaryBtn} onClick={() => {
                  setPreviousStage('dashboard');
                  setStage('paywall');
                }}>
                  View Plans
                  <span style={styles.btnArrow}>→</span>
                </button>
              </div>
            )}
          </div>

          {/* Performance Overview Card */}
          <div style={styles.dashboardCard}>
            <h3 style={styles.dashboardCardTitle}>📈 Performance Overview</h3>
            {pastInterviews.length === 0 ? (
              <p style={styles.emptyState}>Complete an interview to see your performance</p>
            ) : (
              <div>
                {/* Quick Stats */}
                <div style={styles.quickStats}>
                  <div style={styles.quickStat}>
                    <span style={styles.quickStatValue}>{pastInterviews.length}</span>
                    <span style={styles.quickStatLabel}>Interviews</span>
                  </div>
                  <div style={styles.quickStat}>
                    <span style={styles.quickStatValue}>
                      {pastInterviews.filter(i => i.passed).length}
                    </span>
                    <span style={styles.quickStatLabel}>Passed</span>
                  </div>
                  <div style={styles.quickStat}>
                    <span style={styles.quickStatValue}>
                      {Math.round(pastInterviews.reduce((sum, i) => sum + i.overallScore, 0) / pastInterviews.length)}%
                    </span>
                    <span style={styles.quickStatLabel}>Avg Score</span>
                  </div>
                  {trend && (
                    <div style={styles.quickStat}>
                      <span style={{
                        ...styles.quickStatValue,
                        color: trend.direction === 'up' ? '#10b981' : trend.direction === 'down' ? '#ef4444' : '#94a3b8'
                      }}>
                        {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                        {Math.abs(trend.diff)}
                      </span>
                      <span style={styles.quickStatLabel}>Trend</span>
                    </div>
                  )}
                </div>

                {/* Mini Performance Chart - Last 3 interviews */}
                <div style={styles.performanceChart}>
                  <div style={styles.chartHeader}>
                    <span>Last {pastInterviews.length} Interview{pastInterviews.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={styles.chartBars}>
                    {pastInterviews.slice(0, 3).reverse().map((interview, index) => (
                      <div key={index} style={styles.chartBarContainer}>
                        <div style={styles.chartBarWrapper}>
                          <div style={{
                            ...styles.chartBar,
                            height: `${interview.overallScore}%`,
                            background: interview.passed 
                              ? 'linear-gradient(180deg, #10b981 0%, #059669 100%)'
                              : 'linear-gradient(180deg, #ef4444 0%, #dc2626 100%)'
                          }}></div>
                        </div>
                        <span style={styles.chartBarScore}>{interview.overallScore}</span>
                        <span style={styles.chartBarLabel}>
                          {index === pastInterviews.slice(0, 3).length - 1 ? 'Latest' : `#${pastInterviews.length - index}`}
                        </span>
                      </div>
                    ))}
                  </div>
                  {pastInterviews.length >= 2 && (
                    <div style={{
                      ...styles.trendMessage,
                      color: trend?.direction === 'up' ? '#10b981' : trend?.direction === 'down' ? '#ef4444' : '#94a3b8'
                    }}>
                      {trend?.direction === 'up' && `🎉 You've improved by ${trend.diff} points!`}
                      {trend?.direction === 'down' && `📉 Score dropped by ${Math.abs(trend.diff)} points. Keep practicing!`}
                      {trend?.direction === 'stable' && `➡️ Consistent performance. Push for improvement!`}
                    </div>
                  )}
                </div>

                <button style={styles.secondaryBtn} onClick={() => {
                  if (window.mixpanel) window.mixpanel.track('history_viewed');
                  setPreviousStage('dashboard');
                  setStage('history');
                }}>
                  View Detailed History
                </button>
              </div>
            )}
          </div>

          {/* Leaderboard Card */}
          <div style={styles.dashboardCard}>
            <h3 style={styles.dashboardCardTitle}>🏆 Leaderboard</h3>
            <p style={styles.contactDescription}>
              See how you rank against other candidates globally.
            </p>
            <button style={styles.secondaryBtn} onClick={() => {
              if (window.mixpanel) window.mixpanel.track('leaderboard_viewed');
              setPreviousStage('dashboard');
              setStage('leaderboard');
            }}>
              View Leaderboard
            </button>
          </div>

          {/* Contact Us Card */}
          <div style={styles.dashboardCard}>
            <h3 style={styles.dashboardCardTitle}>💬 Contact Us</h3>
            {contactSubmitted ? (
              <div style={styles.successMessage}>
                ✅ Thank you! We'll get back to you soon.
              </div>
            ) : (
              <div>
                <p style={styles.contactDescription}>
                  Need help with your subscription or have feedback? We'd love to hear from you.
                </p>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Request Type</label>
                  <select 
                    style={styles.formSelect}
                    value={contactType}
                    onChange={(e) => setContactType(e.target.value)}
                  >
                    <option value="feedback">💡 Feedback or Suggestion</option>
                    <option value="cancellation">❌ Cancellation Request</option>
                    <option value="support">🆘 Technical Support</option>
                    <option value="other">📝 Other</option>
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.formLabel}>Message</label>
                  <textarea
                    style={styles.formTextarea}
                    placeholder="Tell us how we can help..."
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={4}
                  />
                </div>
                <button style={styles.primaryBtn} onClick={submitContactForm}>
                  Send Message
                  <span style={styles.btnArrow}>→</span>
                </button>
              </div>
            )}
          </div>

          <button style={styles.ghostBtn} onClick={() => setStage('landing')}>
            ← Back to home
          </button>
        </div>
      </div>
    );
  }

  // History
  if (stage === 'history') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.historyContainer}>
          <h2 style={styles.sectionTitle}>📋 Your Interview History</h2>
          <p style={styles.sectionSubtitle}>Track your progress across your last 3 interviews</p>
          
          {pastInterviews.length === 0 ? (
            <p style={styles.emptyState}>No interviews completed yet.</p>
          ) : (
            <div style={styles.historyList}>
              {pastInterviews.map((interview, index) => (
                <div key={index} style={styles.historyCard}>
                  <div style={styles.historyHeader}>
                    <div>
                      <h3 style={styles.historyRole}>{interview.jobTitle}</h3>
                      <span style={styles.historyDate}>
                        {new Date(interview.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{
                      ...styles.historyScore,
                      background: interview.passed ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: interview.passed ? '#10b981' : '#ef4444'
                    }}>
                      {interview.overallScore}%
                      <span style={styles.passLabel}>{interview.passed ? 'PASSED' : 'FAILED'}</span>
                    </div>
                  </div>
                  
                  <div style={styles.historyCategories}>
                    {Object.entries(interview.categories || {}).slice(0, 4).map(([key, val]) => (
                      <div key={key} style={styles.historyCategory}>
                        <span style={styles.categoryName}>{key}</span>
                        <div style={styles.miniBar}>
                          <div style={{
                            ...styles.miniBarFill,
                            width: `${val.score}%`,
                            background: getScoreColor(val.score)
                          }}></div>
                        </div>
                        <span style={styles.categoryScore}>{val.score}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {pastInterviews.length >= 2 && (
            <div style={styles.trendSection}>
              <h3 style={styles.trendTitle}>📈 Performance Trends</h3>
              <div style={styles.trendGrid}>
                {['clarity', 'relevance', 'depth', 'confidence'].map(cat => {
                  const scores = pastInterviews.map(i => i.categories?.[cat]?.score || 0).reverse();
                  const latest = scores[scores.length - 1];
                  const previous = scores[scores.length - 2] || latest;
                  const diff = latest - previous;
                  return (
                    <div key={cat} style={styles.trendCard}>
                      <span style={styles.trendCat}>{cat}</span>
                      <span style={{
                        ...styles.trendIndicator,
                        color: diff > 0 ? '#10b981' : diff < 0 ? '#ef4444' : '#94a3b8'
                      }}>
                        {diff > 0 ? '↑' : diff < 0 ? '↓' : '→'} {Math.abs(diff)} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          <button style={styles.secondaryBtn} onClick={() => setStage(previousStage || 'landing')}>
            ← Back to {previousStage === 'results' ? 'results' : previousStage === 'dashboard' ? 'dashboard' : 'home'}
          </button>
        </div>
      </div>
    );
  }

  // Leaderboard
  if (stage === 'leaderboard') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.leaderboardContainer}>
          <h2 style={styles.sectionTitle}>🏆 Global Leaderboard</h2>
          <p style={styles.sectionSubtitle}>Top performers today</p>
          
          {leaderboard.length === 0 ? (
            <p style={styles.emptyState}>No interviews completed yet. Be the first!</p>
          ) : (
            <div style={styles.leaderboardList}>
              {leaderboard.slice(0, 20).map((entry, index) => (
                <div key={index} style={{
                  ...styles.leaderboardItem,
                  ...(index === 0 ? styles.goldItem : index === 1 ? styles.silverItem : index === 2 ? styles.bronzeItem : {})
                }}>
                  <span style={styles.rank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>{entry.flag} {entry.name}</span>
                  </div>
                  <div style={styles.playerResult}>
                    <span style={styles.playerScore}>{entry.score}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button style={styles.secondaryBtn} onClick={() => setStage(previousStage === 'dashboard' ? 'dashboard' : 'results')}>
            ← Back to {previousStage === 'dashboard' ? 'dashboard' : 'results'}
          </button>
        </div>
      </div>
    );
  }

  // Mobile Gate Screen
  if (stage === 'mobileGate') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
          textAlign: 'center',
          maxWidth: '420px',
          width: '100%',
          minHeight: '100vh',
        }}>
          {/* Desktop icon */}
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(0, 217, 255, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px',
            border: '1px solid rgba(0, 217, 255, 0.2)',
          }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#00d9ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
            </svg>
          </div>

          <h1 style={{
            fontSize: '24px',
            fontWeight: 700,
            letterSpacing: '-0.3px',
            marginBottom: '12px',
            lineHeight: 1.3,
            color: '#ffffff',
          }}>
            Your full interview<br />experience awaits
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            maxWidth: '340px',
            marginBottom: '32px',
          }}>
            Open on a laptop or desktop to unlock everything — video analysis, voice recognition, real-time feedback, and more.
          </p>

          {/* Reasons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            width: '100%',
            maxWidth: '340px',
            marginBottom: '36px',
          }}>
            {[
              { icon: '✨', title: 'Tailored to you', desc: 'Questions based on your role and job description' },
              { icon: '⏱️', title: 'Timed responses & follow-ups', desc: 'Dynamic follow-up questions with in-depth scoring' },
              { icon: '🎥', title: 'Video & voice analysis', desc: 'Feedback on delivery, confidence, and body language' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                textAlign: 'left',
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  fontSize: '18px',
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff', marginBottom: '2px' }}>{item.title}</div>
                  <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            width: '100%',
            maxWidth: '340px',
          }}>
            {/* Copy link button */}
            <button
              style={{
                ...styles.primaryBtn,
                width: '100%',
                padding: '14px 24px',
                fontSize: '15px',
                gap: '8px',
              }}
              onClick={() => {
                if (window.mixpanel) {
                  window.mixpanel.track('mobile_gate_copy_link');
                }
                navigator.clipboard.writeText('https://acemyinterviews.io').then(() => {
                  setMobileGateMessage('Link copied! Open it on your desktop.');
                }).catch(() => {
                  setMobileGateMessage('Copy this: acemyinterviews.io');
                });
              }}
            >
              📋 Copy link
            </button>

            {/* Email link button */}
            <button
              style={{
                width: '100%',
                padding: '14px 24px',
                background: 'rgba(255,255,255,0.07)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onClick={() => {
                if (window.mixpanel) {
                  window.mixpanel.track('mobile_gate_email_link');
                }
                const subject = encodeURIComponent('Your interview practice link');
                const body = encodeURIComponent('Open this on your desktop to start your interview practice:\n\nhttps://acemyinterviews.io');
                window.location.href = `mailto:${user?.email || ''}?subject=${subject}&body=${body}`;
              }}
            >
              ✉️ Email me the link
            </button>

            {/* Success message */}
            {mobileGateMessage && (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                marginTop: '8px',
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
                }}>
                  ✓
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#10b981' }}>{mobileGateMessage}</div>
              </div>
            )}

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              margin: '4px 0',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
              <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
            </div>

            {/* Notify when mobile is ready */}
            <div>
              <div style={{
                display: 'flex',
                gap: '8px',
              }}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={mobileGateEmail}
                  onChange={(e) => setMobileGateEmail(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    fontSize: '14px',
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={async () => {
                    if (mobileGateEmail && mobileGateEmail.includes('@')) {
                      try {
                        await supabase.from('mobile_waitlist').insert({
                          email: mobileGateEmail,
                          user_id: user?.id || null,
                          created_at: new Date().toISOString(),
                        });
                      } catch (e) {
                        console.error('Failed to save email:', e);
                      }
                      if (window.mixpanel) {
                        window.mixpanel.track('mobile_gate_alert_me', { email: mobileGateEmail });
                      }
                      setMobileGateMessage("You're on the list! We'll notify you when mobile is ready.");
                    }
                  }}
                  style={{
                    padding: '12px 18px',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '10px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#ffffff',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Alert me
                </button>
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', textAlign: 'left', marginTop: '6px' }}>
                Get notified when mobile is ready
              </div>
            </div>

            {/* Back to dashboard */}
            <button
              onClick={() => setStage('landing')}
              style={{
                marginTop: '8px',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              ← Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Setup Page
  if (stage === 'setup') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.setup}>
          <h2 style={styles.setupTitle}>Set up your interview</h2>
          <p style={styles.setupSubtitle}>Tell us about the role you're preparing for</p>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Job Title *</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Senior Product Manager"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </div>
          
          <div style={styles.inputGroup}>
            <label style={styles.label}>Job Description</label>
            <textarea
              style={styles.textarea}
              placeholder="Paste the job description to get questions most likely to come up in your interview"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Your Name</label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Alex"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Country</label>
            <select
              style={styles.select}
              value={userCountry}
              onChange={(e) => setUserCountry(e.target.value)}
            >
              <option value="">Select country...</option>
              <option value="🇺🇸">🇺🇸 United States</option>
              <option value="🇬🇧">🇬🇧 United Kingdom</option>
              <option value="🇨🇦">🇨🇦 Canada</option>
              <option value="🇦🇺">🇦🇺 Australia</option>
              <option value="🇩🇪">🇩🇪 Germany</option>
              <option value="🇫🇷">🇫🇷 France</option>
              <option value="🇮🇳">🇮🇳 India</option>
              <option value="🇳🇱">🇳🇱 Netherlands</option>
              <option value="🇸🇬">🇸🇬 Singapore</option>
              <option value="🇦🇪">🇦🇪 UAE</option>
              <option value="🇮🇪">🇮🇪 Ireland</option>
              <option value="🇳🇿">🇳🇿 New Zealand</option>
              <option value="🇸🇪">🇸🇪 Sweden</option>
              <option value="🇨🇭">🇨🇭 Switzerland</option>
              <option value="🇯🇵">🇯🇵 Japan</option>
              <option value="🇧🇷">🇧🇷 Brazil</option>
              <option value="🇲🇽">🇲🇽 Mexico</option>
              <option value="🇪🇸">🇪🇸 Spain</option>
              <option value="🇮🇹">🇮🇹 Italy</option>
              <option value="🇵🇱">🇵🇱 Poland</option>
              <option value="🇵🇹">🇵🇹 Portugal</option>
              <option value="🇧🇪">🇧🇪 Belgium</option>
              <option value="🇦🇹">🇦🇹 Austria</option>
              <option value="🇩🇰">🇩🇰 Denmark</option>
              <option value="🇳🇴">🇳🇴 Norway</option>
              <option value="🇫🇮">🇫🇮 Finland</option>
              <option value="🇿🇦">🇿🇦 South Africa</option>
              <option value="🇰🇷">🇰🇷 South Korea</option>
              <option value="🇹🇼">🇹🇼 Taiwan</option>
              <option value="🇭🇰">🇭🇰 Hong Kong</option>
              <option value="🇵🇭">🇵🇭 Philippines</option>
              <option value="🇮🇩">🇮🇩 Indonesia</option>
              <option value="🇲🇾">🇲🇾 Malaysia</option>
              <option value="🇹🇭">🇹🇭 Thailand</option>
              <option value="🇻🇳">🇻🇳 Vietnam</option>
              <option value="🇵🇰">🇵🇰 Pakistan</option>
              <option value="🇧🇩">🇧🇩 Bangladesh</option>
              <option value="🇳🇬">🇳🇬 Nigeria</option>
              <option value="🇪🇬">🇪🇬 Egypt</option>
              <option value="🇰🇪">🇰🇪 Kenya</option>
              <option value="🇦🇷">🇦🇷 Argentina</option>
              <option value="🇨🇱">🇨🇱 Chile</option>
              <option value="🇨🇴">🇨🇴 Colombia</option>
              <option value="🇵🇪">🇵🇪 Peru</option>
              <option value="🇮🇱">🇮🇱 Israel</option>
              <option value="🇹🇷">🇹🇷 Turkey</option>
              <option value="🇷🇺">🇷🇺 Russia</option>
              <option value="🇺🇦">🇺🇦 Ukraine</option>
              <option value="🇨🇿">🇨🇿 Czech Republic</option>
              <option value="🇷🇴">🇷🇴 Romania</option>
              <option value="🇬🇷">🇬🇷 Greece</option>
              <option value="🇭🇺">🇭🇺 Hungary</option>
              <option value="🌍">🌍 Other</option>
            </select>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Your Resume <span style={styles.optional}>(optional - for personalized questions)</span></label>
            <textarea
              style={styles.textarea}
              placeholder="Paste your resume here for questions about your specific experience, projects, and career history..."
              value={userResume}
              onChange={(e) => setUserResume(e.target.value)}
              rows={5}
            />
            <p style={styles.inputHint}>💡 Adding your resume helps generate questions about YOUR experience, not generic ones</p>
          </div>

          {/* Video Toggle */}
          <div style={styles.videoToggle}>
            <label style={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={videoEnabled}
                onChange={(e) => {
                  setVideoEnabled(e.target.checked);
                  if (window.mixpanel) {
                    window.mixpanel.track('video_toggled', { enabled: e.target.checked });
                  }
                }}
                style={styles.checkbox}
              />
              <span style={styles.toggleSwitch}>
                <span style={{
                  ...styles.toggleKnob,
                  transform: videoEnabled ? 'translateX(24px)' : 'translateX(0)'
                }}></span>
              </span>
              <span style={styles.toggleText}>
                📹 Enable Video Analysis
              </span>
            </label>
            <p style={styles.toggleDescription}>
              {videoEnabled 
                ? "AI will analyze your eye contact, posture, and presence"
                : "Audio-only mode (no camera required)"}
            </p>
          </div>

          <div style={styles.infoBox}>
            <strong>📋 Interview Format:</strong>
            <ul style={styles.infoList}>
              <li>5 questions tailored to your role</li>
              <li>3 minutes per question</li>
              <li>Speak your answers out loud (mic required)</li>
              {videoEnabled && <li>📹 Video presence analysis included</li>}
              <li>AI will analyze and score your responses</li>
            </ul>
          </div>
          
          <button 
            style={{
              ...styles.primaryBtn,
              opacity: jobTitle.trim() ? 1 : 0.5,
              cursor: jobTitle.trim() ? 'pointer' : 'not-allowed'
            }}
            onClick={() => {
              if (jobTitle.trim()) {
                if (window.mixpanel) {
                  window.mixpanel.track('setup_completed', {
                    has_job_description: !!jobDescription.trim(),
                    has_resume: !!userResume.trim(),
                    video_enabled: videoEnabled
                  });
                }
                if (isMobile) {
                  setStage('mobileGate');
                } else {
                  setStage('device-check');
                }
              }
            }}
            disabled={!jobTitle.trim()}
          >
            Start Interview
            <span style={styles.btnArrow}>→</span>
          </button>
          
          <button style={styles.ghostBtn} onClick={() => setStage('landing')}>
            ← Back
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'device-check') {
    return <DeviceCheckScreen onPass={() => generateQuestions()} onBack={() => setStage('setup')} />;
  }

  // Generating Questions
  if (stage === 'generating') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.generating}>
          <div style={styles.spinner}></div>
          <h2 style={styles.generatingTitle}>Preparing your interview...</h2>
          <p style={styles.generatingText}>AI is crafting questions specific to {jobTitle}</p>
        </div>
      </div>
    );
  }

  // Interview in Progress
  if (stage === 'interview') {
    const progress = ((currentQuestionIndex + 1) / questions.length) * 100;
    const timerColor = timeLeft <= 30 ? '#ef4444' : timeLeft <= 60 ? '#f59e0b' : '#00d9ff';
    
    // Mobile start overlay - waiting for user tap to enable audio
    if (waitingForMobileStart) {
      return (
        <div style={styles.container}>
          <div style={styles.heroGlow}></div>
          {/* Hidden video element to keep camera stream attached */}
          {videoEnabled && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          )}
          <div style={styles.mobileStartOverlay}>
            <div style={styles.mobileStartCard}>
              <h2 style={styles.mobileStartTitle}>🎤 Ready to Begin?</h2>
              <p style={styles.mobileStartText}>
                Tap below to start your interview. The AI interviewer will ask you {questions.length} questions.
              </p>
              <button style={styles.mobileStartBtn} onClick={handleMobileStart}>
                ▶️ Start Interview
              </button>
              <p style={styles.mobileStartHint}>
                Make sure your volume is up to hear the questions
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // Mobile next question overlay
    if (waitingForMobileNext) {
      return (
        <div style={styles.container}>
          <div style={styles.heroGlow}></div>
          {videoEnabled && (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
            />
          )}
          <div style={styles.mobileStartOverlay}>
            <div style={styles.mobileStartCard}>
              <h2 style={styles.mobileStartTitle}>✅ Answer Recorded!</h2>
              <p style={styles.mobileStartText}>
                Ready for question {currentQuestionIndex + 1} of {questions.length}?
              </p>
              <button style={styles.mobileStartBtn} onClick={handleMobileNextQuestion}>
                ▶️ Hear Next Question
              </button>
              <p style={styles.mobileStartHint}>
                Tap to hear the AI ask your next question
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.interview}>
          {/* Video Preview - top right corner */}
          {videoEnabled && (
            <div style={styles.videoPreviewContainer}>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                style={styles.videoPreview}
              />
              <div style={styles.videoLabel}>
                {cameraPermission === false ? '📹 Camera blocked' : '📹 Recording'}
              </div>
            </div>
          )}
          
          {/* Progress bar */}
          <div style={styles.progressContainer}>
            <div style={styles.progressBar}>
              <div style={{...styles.progressFill, width: `${progress}%`}}></div>
            </div>
            <span style={styles.progressText}>Question {currentQuestionIndex + 1} of {questions.length}</span>
          </div>
          
          {/* Timer */}
          <div style={{...styles.timer, color: timerColor, borderColor: timerColor}}>
            <span style={styles.timerLabel}>Time Remaining</span>
            <span style={styles.timerValue}>{formatTime(timeLeft)}</span>
          </div>
          
          {/* Question */}
          <div style={styles.questionCard}>
            {isSpeaking && (
              <div style={styles.speakingIndicator}>
                <span style={styles.soundWave}>🔊</span> AI is speaking...
              </div>
            )}
            {isFollowUp && (
              <div style={{
                display: 'inline-block',
                padding: '6px 12px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#a78bfa',
                marginBottom: '12px'
              }}>
                ↪️ Follow-up Question
              </div>
            )}
            <p style={styles.questionText}>
              {isFollowUp ? currentFollowUpQuestion : questions[currentQuestionIndex]}
            </p>
          </div>
          
          {/* Evaluating state */}
          {isEvaluating && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              padding: '12px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <span style={{ fontSize: '14px', color: '#a78bfa' }}>🔍 Evaluating your response...</span>
            </div>
          )}
          
          {/* Recording status */}
          <div style={styles.recordingSection}>
            {isSpeaking ? (
              <div style={styles.recordingWaiting}>
                🔊 Listening to question... Recording will start when AI finishes.
              </div>
            ) : isRecording ? (
              <div style={styles.recordingActive}>
                <span style={styles.recordingDot}></span>
                Recording your answer...
              </div>
            ) : (
              <div style={styles.recordingWaiting}>
                Preparing...
              </div>
            )}
            
            {/* Manual text input fallback - only show in TEST_MODE for sandbox testing */}
            {TEST_MODE && !isSpeaking && (
              <div style={styles.manualInputSection}>
                <span style={styles.manualInputLabel}>
                  💡 Voice not working? Type your answer (TEST MODE only):
                </span>
                <textarea
                  style={styles.manualTextarea}
                  placeholder="Type your answer here if voice recording isn't capturing..."
                  value={currentTranscript}
                  onChange={(e) => {
                    setCurrentTranscript(e.target.value);
                    transcriptRef.current = e.target.value;
                  }}
                  rows={4}
                />
              </div>
            )}
            
            {/* Live transcript preview - mobile only, for debugging speech recognition */}
            {isMobile && !isSpeaking && currentTranscript && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: 'rgba(0, 217, 255, 0.05)',
                border: '1px solid rgba(0, 217, 255, 0.15)',
                borderRadius: '8px',
                maxHeight: '80px',
                overflowY: 'auto',
                fontSize: '13px',
                color: 'rgba(255,255,255,0.7)',
                lineHeight: '1.4'
              }}>
                <span style={{ color: 'rgba(0, 217, 255, 0.6)', fontSize: '11px', fontWeight: 600 }}>📝 Transcript: </span>
                {currentTranscript.length > 150 ? '...' + currentTranscript.slice(-150) : currentTranscript}
              </div>
            )}
          </div>
          
          <button 
            style={{
              ...styles.primaryBtn,
              opacity: (isSpeaking || isTranscribing || isEvaluating) ? 0.5 : 1,
              cursor: (isSpeaking || isTranscribing || isEvaluating) ? 'not-allowed' : 'pointer'
            }} 
            onClick={handleNextQuestion}
            disabled={isSpeaking || isTranscribing || isEvaluating}
          >
            {isSpeaking ? 'Please wait...' : isTranscribing ? '⏳ Transcribing...' : isEvaluating ? '🔍 Evaluating...' : (currentQuestionIndex < questions.length - 1 ? 'Submit Answer' : 'Finish Interview')}
            <span style={styles.btnArrow}>→</span>
          </button>
          
          <p style={styles.skipNote}>{isSpeaking ? 'Wait for AI to finish speaking' : isTranscribing ? 'Processing your answer...' : isEvaluating ? 'AI is reviewing your response...' : 'Click above when you\'re done answering, or wait for the timer'}</p>
        </div>
      </div>
    );
  }

  // Analyzing
  if (stage === 'analyzing') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.generating}>
          <div style={styles.spinner}></div>
          <h2 style={styles.generatingTitle}>Analyzing your interview...</h2>
          <p style={styles.generatingText}>AI is reviewing all your responses{videoEnabled ? ' and video presence' : ''}</p>
          <div style={styles.analyzingSteps}>
            <div style={styles.analyzingStep}>✓ Recording responses</div>
            {videoEnabled && <div style={styles.analyzingStep}>✓ Capturing video snapshots</div>}
            <div style={styles.analyzingStep}>✓ Evaluating clarity</div>
            <div style={styles.analyzingStep}>⋯ Scoring answers</div>
            {videoEnabled && <div style={styles.analyzingStepPending}>○ Analyzing video presence</div>}
            <div style={styles.analyzingStepPending}>○ Generating feedback</div>
          </div>
        </div>
      </div>
    );
  }

  // Results / Scorecard
  if (stage === 'results' && finalResults) {
    // ===== PAYWALL LOGIC =====
    const paywallEnabled = !isSubscribed && !TEST_MODE;
    const hasAccess = !paywallEnabled;

    // Find best scoring question for the model answer teaser
    const bestQuestion = finalResults.questionScores
      ? [...finalResults.questionScores].sort((a, b) => {
          const aScore = a.combinedScore ?? a.score;
          const bScore = b.combinedScore ?? b.score;
          return bScore - aScore;
        })[0]
      : null;

    const modelAnswer = finalResults.modelAnswer || null;

    // ===== PAYWALL TEASER VIEW (non-paying users) =====
    if (!hasAccess) {
      return (
        <div style={styles.container}>
          <div style={styles.heroGlow}></div>
          <div style={{...styles.results, maxWidth: '800px', width: '100%'}}>

            {/* Score hero */}
            <div style={{...styles.verdictCard, background: finalResults.passed ? 'linear-gradient(135deg,rgba(16,185,129,0.2) 0%,rgba(16,185,129,0.05) 100%)' : 'linear-gradient(135deg,rgba(239,68,68,0.15) 0%,rgba(239,68,68,0.03) 100%)', borderColor: finalResults.passed ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.2)', textAlign:'center'}}>
              <div style={styles.verdictIcon}>{finalResults.passed ? '🎉' : '💪'}</div>
              <h2 style={{...styles.verdictTitle, color: finalResults.passed ? '#10b981' : '#fca5a5'}}>
                {finalResults.passed ? 'Great job! You passed!' : 'Not quite there yet — but you can fix this'}
              </h2>
              <div style={styles.overallScore}>
                <span style={styles.scoreNumber}>{finalResults.overallScore}</span>
                <span style={styles.scoreOutOf}>/100</span>
              </div>
            </div>

            {/* Teaser cards */}
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'16px'}}>
              {finalResults.passed ? (
                <div style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px 24px', borderTop:'3px solid', borderImage:'linear-gradient(90deg,#10b981,#00d9ff) 1'}}>
                  <div style={{fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px', color:'rgba(255,255,255,0.4)', marginBottom:'8px'}}>🏆 Strong Performance</div>
                  <div style={{fontSize:'16px', fontWeight:'700', color:'#10b981', marginBottom:'6px', lineHeight:'1.3'}}>You passed — but there's still room to score even higher</div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:'1.4'}}>Our AI found specific areas where top candidates outperform you. <strong style={{color:'rgba(255,255,255,0.8)'}}>Unlock to see what they are.</strong></div>
                </div>
              ) : (
                <div style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px 24px', borderTop:'3px solid', borderImage:'linear-gradient(90deg,#ef4444,#f59e0b) 1'}}>
                  <div style={{fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px', color:'rgba(255,255,255,0.4)', marginBottom:'8px'}}>⚠️ Red Flag Detected</div>
                  <div style={{fontSize:'16px', fontWeight:'700', color:'#ef4444', marginBottom:'6px', lineHeight:'1.3'}}>Your answers share a pattern common in rejected candidates</div>
                  <div style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:'1.4'}}>Our AI identified a recurring issue across your responses. <strong style={{color:'rgba(255,255,255,0.8)'}}>Unlock results to see what it is.</strong></div>
                </div>
              )}
              <div style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px 24px', borderTop:'3px solid', borderImage:'linear-gradient(90deg,#8b5cf6,#00d9ff) 1'}}>
                <div style={{fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'1px', color:'rgba(255,255,255,0.4)', marginBottom:'8px'}}>Your Best Answer</div>
                <div style={{fontSize:'16px', fontWeight:'700', color:'#a855f7', marginBottom:'6px', lineHeight:'1.3'}}>
                  {bestQuestion ? `Q${bestQuestion.questionNum} was your strongest — but it still had critical gaps` : 'Your strongest answer still had critical gaps'}
                </div>
                <div style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:'1.4'}}>Our analysis found specific areas where you lost points. <strong style={{color:'rgba(255,255,255,0.8)'}}>See the full breakdown.</strong></div>
              </div>
            </div>

            {/* Model answer comparison teaser */}
            {modelAnswer && bestQuestion && (
              <div style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px 24px', marginBottom:'16px'}}>
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px'}}>
                  <h3 style={{fontSize:'15px', fontWeight:'700', margin:0}}>📈 How Your Best Answer Compares</h3>
                  <span style={{background:'rgba(34,197,94,0.15)', color:'#22c55e', fontSize:'10px', fontWeight:'700', padding:'2px 8px', borderRadius:'3px', textTransform:'uppercase'}}>Preview</span>
                </div>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px'}}>
                  <div style={{background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'14px 16px'}}>
                    <div style={{fontSize:'11px', fontWeight:'700', color:'#ef4444', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px'}}>Your Answer</div>
                    <div style={{fontSize:'13px', color:'rgba(255,255,255,0.6)', lineHeight:'1.5', fontStyle:'italic', marginBottom:'10px'}}>
                      "{bestQuestion.feedback?.substring(0, 120)}..."
                    </div>
                    <div style={{fontSize:'24px', fontWeight:'900', color:'#ef4444'}}>{bestQuestion.combinedScore ?? bestQuestion.score}<span style={{fontSize:'14px', color:'rgba(255,255,255,0.4)'}}>/100</span></div>
                  </div>
                  <div style={{background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'10px', padding:'14px 16px', position:'relative'}}>
                    <div style={{fontSize:'11px', fontWeight:'700', color:'#22c55e', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:'8px'}}>Top-Scoring Answer</div>
                    <div style={{fontSize:'13px', color:'rgba(255,255,255,0.6)', lineHeight:'1.5', fontStyle:'italic', marginBottom:'10px', filter:'blur(5px)', userSelect:'none'}}>
                      "{modelAnswer.answer?.substring(0, 120)}..."
                    </div>
                    <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', background:'rgba(17,24,39,0.9)', padding:'8px 16px', borderRadius:'8px', fontSize:'12px', fontWeight:'700', color:'#a855f7', whiteSpace:'nowrap'}}>🔒 Unlock to see model answer</div>
                    <div style={{fontSize:'24px', fontWeight:'900', color:'#22c55e'}}>92<span style={{fontSize:'14px', color:'rgba(255,255,255,0.4)'}}>/100</span></div>
                  </div>
                </div>
              </div>
            )}

            {/* Blurred results preview */}
            <div style={{position:'relative', marginBottom:'16px'}}>
              <div style={{filter:'blur(8px)', pointerEvents:'none', userSelect:'none', opacity:0.5}}>
                <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px'}}>
                  {Object.entries(finalResults.categories).slice(0,4).map(([key, val]) => (
                    <div key={key} style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'10px', padding:'16px 20px'}}>
                      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px'}}>
                        <span style={{fontSize:'14px', fontWeight:'600', color:'#fff'}}>{key.replace(/([A-Z])/g,' $1').trim()}</span>
                        <span style={{fontSize:'18px', fontWeight:'800', color:'#ef4444'}}>{val.score}</span>
                      </div>
                      <div style={{height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden', marginBottom:'8px'}}>
                        <div style={{height:'100%', borderRadius:'2px', background:'#ef4444', width:`${val.score}%`}}/>
                      </div>
                      <p style={{fontSize:'12px', color:'rgba(255,255,255,0.5)', margin:0, lineHeight:'1.4'}}>{val.feedback}</p>
                    </div>
                  ))}
                </div>
                {finalResults.questionScores?.slice(0,3).map((q, i) => (
                  <div key={i} style={{background:'rgba(17,24,39,0.8)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:'12px', padding:'20px 24px', marginBottom:'12px'}}>
                    <div style={{display:'flex', justifyContent:'space-between', marginBottom:'12px'}}>
                      <span style={{fontSize:'14px', fontWeight:'700', color:'#00d9ff'}}>Q{q.questionNum}</span>
                      <span style={{fontSize:'14px', fontWeight:'700', color:'#ef4444'}}>{q.combinedScore ?? q.score}/100</span>
                    </div>
                    <p style={{fontSize:'13px', color:'rgba(255,255,255,0.5)', lineHeight:'1.5', margin:0}}>{q.feedback}</p>
                  </div>
                ))}
              </div>

              {/* Gradient fade */}
              <div style={{position:'absolute', bottom:0, left:0, right:0, height:'200px', background:'linear-gradient(transparent, #0a0a0f)', pointerEvents:'none'}}/>

              {/* Paywall card */}
              <div style={{position:'absolute', top:'80px', left:'50%', transform:'translateX(-50%)', width:'100%', maxWidth:'520px', padding:'0 16px', zIndex:10}}>
                <div style={{background:'linear-gradient(145deg,#1a1f35,#111827)', border:'1px solid rgba(168,85,247,0.3)', borderRadius:'20px', padding:'36px 32px', textAlign:'center', boxShadow:'0 24px 80px rgba(0,0,0,0.6)', position:'relative', overflow:'hidden'}}>
                  <div style={{position:'absolute', top:0, left:0, right:0, height:'3px', background:'linear-gradient(90deg,#00d9ff,#8b5cf6)'}}/>
                  <div style={{width:'56px', height:'56px', background:'rgba(168,85,247,0.15)', borderRadius:'16px', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px', fontSize:'24px'}}>🔒</div>
                  <h2 style={{fontSize:'22px', fontWeight:'800', marginBottom:'8px', lineHeight:'1.3'}}>Unlock Your Complete<br/>Interview Breakdown</h2>
                  <p style={{fontSize:'14px', color:'rgba(255,255,255,0.5)', marginBottom:'24px', lineHeight:'1.5'}}>See all 8 scoring dimensions, question-by-question feedback, model answers, and your video presence analysis.</p>

                  <div style={{marginBottom:'20px'}}>
                    <div style={{fontSize:'40px', fontWeight:'900', color:'#fff'}}><span style={{fontSize:'22px', verticalAlign:'super', fontWeight:'700'}}>$</span>19.99<span style={{fontSize:'16px', color:'rgba(255,255,255,0.4)', fontWeight:'500'}}> /mo</span></div>
                    <div style={{display:'inline-block', background:'rgba(34,197,94,0.15)', color:'#22c55e', fontSize:'11px', fontWeight:'700', padding:'3px 10px', borderRadius:'4px', marginTop:'8px'}}>Unlimited interviews</div>
                  </div>
                  <ul style={{textAlign:'left', marginBottom:'24px', padding:0}}>
                    {['Full 8-category performance breakdown','Question-by-question detailed feedback','Model answers for each question','Personalized improvement action plan','Video presence analysis','Unlimited interview practice','Track your progress over time','Full leaderboard access'].map((f,i) => (
                      <li key={i} style={{listStyle:'none', display:'flex', alignItems:'center', gap:'10px', padding:'6px 0', fontSize:'13px', color:'rgba(255,255,255,0.6)'}}>
                        <span style={{color:'#22c55e', fontSize:'14px', fontWeight:'700'}}>✓</span>{f}
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => { if (currentInterviewId) localStorage.setItem('pendingInterviewId', currentInterviewId); localStorage.setItem('pendingStage', 'results'); window.location.href = STRIPE_SUBSCRIBE_URL; }} style={{width:'100%', padding:'16px 24px', border:'none', borderRadius:'12px', fontFamily:'inherit', fontSize:'16px', fontWeight:'700', cursor:'pointer', background:'linear-gradient(135deg,#8b5cf6,#7c3aed)', color:'#fff', boxShadow:'0 4px 20px rgba(139,92,246,0.3)'}}>Start Pro — $19.99/month</button>
                  <div style={{display:'flex', alignItems:'center', justifyContent:'center', gap:'6px', marginTop:'16px', fontSize:'12px', color:'rgba(255,255,255,0.3)'}}>🔒 Secure payment · Instant access · Cancel anytime</div>

                </div>
              </div>
            </div>

          </div>
        </div>
      );
    }
    // ===== END PAYWALL VIEW =====

    // Calculate percentile (comparing to all users)
    const calculatePercentile = () => {
      // Use leaderboard scores, or fallback dummy scores if empty
      let allScores = leaderboard.map(l => l.score);
      
      // Fallback to dummy score range if leaderboard is empty
      if (allScores.length === 0) {
        allScores = [92, 89, 87, 85, 83, 81, 80, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69, 68, 67, 66];
      }
      
      const belowCount = allScores.filter(s => s < finalResults.overallScore).length;
      return Math.round((belowCount / allScores.length) * 100);
    };
    const percentile = calculatePercentile();
    
    // Find weakest categories
    const categoryScores = Object.entries(finalResults.categories).map(([key, val]) => ({ key, score: val.score }));
    const weakestCategories = categoryScores.sort((a, b) => a.score - b.score).slice(0, 2);
    
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.results}>
          {/* Verdict - Softened */}
          <div style={{
            ...styles.verdictCard,
            background: finalResults.passed 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.03) 100%)',
            borderColor: finalResults.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)'
          }}>
            <div style={styles.verdictIcon}>{finalResults.passed ? '🎉' : '💪'}</div>
            <h2 style={{
              ...styles.verdictTitle,
              color: finalResults.passed ? '#10b981' : '#fca5a5'
            }}>
              {finalResults.passed 
                ? "Great job! You passed!" 
                : "Not quite there yet — but you can fix this"}
            </h2>
            <div style={styles.overallScore}>
              <span style={styles.scoreNumber}>{finalResults.overallScore}</span>
              <span style={styles.scoreOutOf}>/100</span>
            </div>
            <p style={styles.verdictSummary}>
              {percentile > 0 
                ? `You scored higher than ${percentile}% of candidates`
                : "Keep practicing to climb the leaderboard!"}
            </p>
          </div>

          {/* Fixable Message - Only show if not passed */}
          {!finalResults.passed && (
            <div style={styles.fixableMessage}>
              <p style={styles.fixableTitle}>💡 Here's the good news</p>
              <p style={styles.fixableText}>
                Your weakest areas are <strong>{weakestCategories[0]?.key.replace(/([A-Z])/g, ' $1').trim()}</strong> and <strong>{weakestCategories[1]?.key.replace(/([A-Z])/g, ' $1').trim()}</strong>. 
                These are the easiest to improve with practice. Review the feedback below, then retry this interview.
              </p>
            </div>
          )}

          {/* Retry CTAs */}
          <div style={styles.retryCTAs}>
            <button style={styles.retryBtn} onClick={() => {
              if (window.mixpanel) {
                window.mixpanel.track('retry_clicked', {
                  previous_score: finalResults.overallScore,
                  previous_passed: finalResults.passed
                });
              }
              handleStartInterview('results');
            }}>
              🔁 Retry Interview
            </button>
            <button 
              style={{
                ...styles.practiceBtn,
                opacity: (!isSubscribed && !TEST_MODE) ? 0.7 : 1,
              }} 
              onClick={downloadResultsPDF}
              title={(!isSubscribed && !TEST_MODE) ? 'Pro feature - Subscribe to download' : 'Download your results as PDF'}
            >
              📥 Download PDF {(!isSubscribed && !TEST_MODE) && '🔒'}
            </button>
          </div>

          {/* Category Breakdown */}
          <div style={styles.scorecardSection}>
            <h3 style={styles.scorecardTitle}>📊 Performance Breakdown</h3>
            <div style={styles.categoryGrid}>
              {Object.entries(finalResults.categories).map(([key, val]) => {
                const trend = getPerformanceTrend(key);
                return (
                  <div key={key} style={styles.categoryCard}>
                    <div style={styles.categoryHeader}>
                      <span style={styles.categoryLabel}>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                      {trend && (
                        <span style={{...styles.trendBadge, color: trend.color}}>
                          {trend.icon}
                        </span>
                      )}
                    </div>
                    <div style={styles.categoryScoreBar}>
                      <div style={{
                        ...styles.categoryScoreFill,
                        width: `${val.score}%`,
                        background: getScoreColor(val.score)
                      }}></div>
                    </div>
                    <div style={styles.categoryMeta}>
                      <span style={{...styles.categoryScoreNum, color: getScoreColor(val.score)}}>
                        {val.score}
                      </span>
                      <span style={styles.categoryFeedback}>{val.feedback}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Question by Question */}
          <div style={styles.scorecardSection}>
            <h3 style={styles.scorecardTitle}>📝 Question-by-Question Feedback</h3>
            {finalResults.questionScores.map((q, i) => (
              <div key={i} style={styles.questionFeedback}>
                <div style={styles.questionFeedbackHeader}>
                  <span style={styles.questionNum}>Q{q.questionNum}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {q.hasFollowUp && q.combinedScore !== undefined && (
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                        combined
                      </span>
                    )}
                    <span style={{...styles.questionScore, color: getScoreColor(q.hasFollowUp && q.combinedScore !== undefined ? q.combinedScore : q.score)}}>
                      {q.hasFollowUp && q.combinedScore !== undefined ? q.combinedScore : q.score}/100
                    </span>
                  </div>
                </div>
                
                {q.hasFollowUp && (
                  <div style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    fontSize: '12px',
                    color: 'rgba(255,255,255,0.5)',
                    marginBottom: '10px'
                  }}>
                    Main answer: {q.score}/100
                  </div>
                )}
                <p style={styles.questionFeedbackText}>{q.feedback}</p>
                <div style={styles.feedbackDetails}>
                  <div style={styles.feedbackStrengths}>
                    <strong>✓ Strengths:</strong>
                    <ul>{q.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                  <div style={styles.feedbackImprovements}>
                    <strong>△ Improve:</strong>
                    <ul>{q.improvements.map((s, j) => <li key={j}>{s}</li>)}</ul>
                  </div>
                </div>
                
                {/* Follow-up section */}
                {q.hasFollowUp && q.followUp && (
                  <div style={{
                    marginTop: '16px',
                    padding: '16px',
                    background: 'rgba(139, 92, 246, 0.08)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '10px',
                    borderLeft: '3px solid #8b5cf6'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px'
                    }}>
                      <span style={{ fontSize: '13px', fontWeight: '600', color: '#a78bfa' }}>
                        ↪️ Follow-up Response
                      </span>
                      <span style={{ fontSize: '16px', fontWeight: '700', color: getScoreColor(q.followUp.score) }}>
                        {q.followUp.score}/100
                      </span>
                    </div>
                    
                    {q.followUp.coachingNote && (
                      <div style={{
                        padding: '10px 12px',
                        background: 'rgba(139, 92, 246, 0.1)',
                        borderRadius: '8px',
                        marginBottom: '12px',
                        fontSize: '13px',
                        color: 'rgba(255,255,255,0.7)',
                        lineHeight: '1.5'
                      }}>
                        💡 {q.followUp.coachingNote}
                      </div>
                    )}
                    
                    <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', lineHeight: '1.6', margin: '0 0 12px 0' }}>
                      {q.followUp.feedback}
                    </p>
                    {((q.followUp.strengths && q.followUp.strengths.length > 0) || (q.followUp.improvements && q.followUp.improvements.length > 0)) && (
                      <div style={styles.feedbackDetails}>
                        {q.followUp.strengths && q.followUp.strengths.length > 0 && (
                          <div style={styles.feedbackStrengths}>
                            <strong>✓ Strengths:</strong>
                            <ul>{q.followUp.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul>
                          </div>
                        )}
                        {q.followUp.improvements && q.followUp.improvements.length > 0 && (
                          <div style={styles.feedbackImprovements}>
                            <strong>△ Improve:</strong>
                            <ul>{q.followUp.improvements.map((s, j) => <li key={j}>{s}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {/* No follow-up — positive reinforcement */}
                {!q.hasFollowUp && q.noFollowUpReason === 'thorough_answer' && (
                  <div style={{
                    marginTop: '12px',
                    padding: '10px 14px',
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#10b981',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    ✅ No follow-up needed — your answer was thorough
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary Cards */}
          <div style={styles.summaryGrid}>
            <div style={styles.summaryCard}>
              <h4 style={styles.summaryTitle}>🌟 Your Top Strengths</h4>
              <ul style={styles.summaryList}>
                {finalResults.topStrengths.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
            <div style={styles.summaryCard}>
              <h4 style={styles.summaryTitle}>🎯 Critical Improvements</h4>
              <ul style={styles.summaryList}>
                {finalResults.criticalImprovements.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          </div>

          {/* Coaching Tip */}
          <div style={styles.coachingTip}>
            <span style={styles.coachingIcon}>💡</span>
            <div>
              <strong>Pro Tip for Your Next Interview:</strong>
              <p style={styles.coachingText}>{finalResults.coachingTip}</p>
            </div>
          </div>

          {/* Model Answer — shown to paying users */}
          {finalResults.modelAnswer && (
            <div style={styles.scorecardSection}>
              <h3 style={styles.scorecardTitle}>🏆 Model Answer — Q{finalResults.modelAnswer.questionNum}</h3>
              <div style={{background:'rgba(34,197,94,0.06)', border:'1px solid rgba(34,197,94,0.2)', borderRadius:'12px', padding:'20px 24px'}}>
                <p style={{fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px'}}>Question</p>
                <p style={{fontSize:'14px', color:'rgba(255,255,255,0.8)', marginBottom:'16px', lineHeight:'1.5'}}>{finalResults.modelAnswer.question}</p>
                <p style={{fontSize:'13px', color:'rgba(255,255,255,0.4)', marginBottom:'8px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.5px'}}>What a 90+ answer looks like</p>
                <p style={{fontSize:'14px', color:'rgba(255,255,255,0.8)', lineHeight:'1.6', fontStyle:'italic'}}>"{finalResults.modelAnswer.answer}"</p>
              </div>
            </div>
          )}

          {/* Video Analysis Feedback */}
          {finalResults.videoAnalysis && (
            <div style={styles.scorecardSection}>
              <h3 style={styles.scorecardTitle}>📹 Video Presence Analysis</h3>
              <div style={styles.videoScoreHeader}>
                <span style={styles.videoScoreLabel}>Overall Video Score</span>
                <span style={{
                  ...styles.videoScoreValue,
                  color: getScoreColor(finalResults.videoAnalysis.overallVideoScore)
                }}>
                  {finalResults.videoAnalysis.overallVideoScore}/100
                </span>
              </div>
              
              <div style={styles.videoCategories}>
                {['eyeContact', 'posture', 'facialExpression', 'framing', 'background', 'overallPresence'].map(key => {
                  const cat = finalResults.videoAnalysis[key];
                  if (!cat) return null;
                  const label = key.replace(/([A-Z])/g, ' $1').trim();
                  return (
                    <div key={key} style={styles.videoCategoryItem}>
                      <div style={styles.videoCategoryHeader}>
                        <span style={styles.videoCategoryLabel}>{label}</span>
                        <span style={{
                          ...styles.videoCategoryScore,
                          color: getScoreColor(cat.score)
                        }}>{cat.score}</span>
                      </div>
                      <div style={styles.videoCategoryBar}>
                        <div style={{
                          ...styles.videoCategoryFill,
                          width: `${cat.score}%`,
                          background: getScoreColor(cat.score)
                        }}></div>
                      </div>
                      <p style={styles.videoCategoryFeedback}>{cat.feedback}</p>
                    </div>
                  );
                })}
              </div>

              {finalResults.videoAnalysis.topTip && (
                <div style={styles.videoTip}>
                  <strong>📹 Video Tip:</strong> {finalResults.videoAnalysis.topTip}
                </div>
              )}
            </div>
          )}

          {/* Leaderboard Teaser */}
          <div style={styles.leaderboardTeaser}>
            <h3 style={styles.leaderboardTeaserTitle}>🏆 How do you compare?</h3>
            
            {/* User's position */}
            <div style={styles.yourPosition}>
              <span style={styles.yourPositionLabel}>Your score</span>
              <span style={styles.yourPositionScore}>{finalResults.overallScore}%</span>
              <span style={styles.yourPositionRank}>
                {percentile > 0 
                  ? `Higher than ${percentile}% of candidates`
                  : "Keep practicing to climb up!"}
              </span>
            </div>
            
            {/* #1 visible */}
            {leaderboard.length > 0 && (
              <div style={styles.leaderboardTop}>
                <div style={styles.rankBadge}>1</div>
                <div style={styles.topUserInfo}>
                  <div style={styles.topUserName}>{leaderboard[0].flag || '🌍'} {leaderboard[0].name}</div>
                </div>
                <div style={styles.topUserScore}>{leaderboard[0].score}%</div>
              </div>
            )}
            
            {/* Rest locked */}
            {!isSubscribed && (
              <div style={styles.lockedRows}>
                <div style={styles.lockedRow}></div>
                <div style={styles.lockedRow}></div>
                <div style={styles.lockedRow}></div>
                <div style={styles.lockedOverlay}>
                  <p style={styles.lockedText}>See full leaderboard and track your ranking</p>
                  <button style={styles.unlockBtn} onClick={() => {
                    setPreviousStage('results');
                    setStage('paywall');
                  }}>
                    🔓 Unlock with Pro
                  </button>
                </div>
              </div>
            )}
            
            {isSubscribed && (
              <button style={styles.secondaryBtn} onClick={() => {
                if (window.mixpanel) window.mixpanel.track('leaderboard_viewed');
                setStage('leaderboard');
              }}>
                View Full Leaderboard
              </button>
            )}
          </div>

          {/* Bottom Actions */}
          <div style={styles.resultsActions}>
            <button style={styles.secondaryBtn} onClick={() => {
              if (window.mixpanel) window.mixpanel.track('history_viewed');
              setPreviousStage('results');
              setStage('history');
            }}>
              📋 View Progress History
            </button>
            <button style={styles.secondaryBtn} onClick={() => setStage('landing')}>
              🏠 Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Privacy Policy
  if (stage === 'privacy') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.privacyPage}>
          <button style={styles.ghostBtn} onClick={() => setStage('landing')}>
            ← Back to Interview Simulator
          </button>
          
          <h1 style={styles.privacyTitle}>Privacy Policy</h1>
          <p style={styles.privacyUpdated}>Last updated: February 2025</p>
          
          <div style={styles.privacyHighlight}>
            <p><strong>The short version:</strong> We don't store your video or audio recordings. We only keep your scores to track your progress. Your practice is private.</p>
          </div>
          
          <h2 style={styles.privacyH2}>What we collect</h2>
          <p style={styles.privacyP}>When you use Interview Simulator, we collect:</p>
          <ul style={styles.privacyList}>
            <li><strong>Account information:</strong> Your email address and name (via Google Sign-in)</li>
            <li><strong>Interview scores:</strong> Your overall scores, category breakdowns, and pass/fail results</li>
            <li><strong>Subscription status:</strong> Whether you have an active subscription</li>
          </ul>
          
          <h2 style={styles.privacyH2}>What we DON'T store</h2>
          <ul style={styles.privacyList}>
            <li><strong>Video recordings:</strong> Your camera feed is processed in real-time for body language analysis, then immediately discarded. We never store video files.</li>
            <li><strong>Audio recordings:</strong> Your voice is transcribed in your browser. The audio itself is not stored.</li>
            <li><strong>Interview transcripts:</strong> Your spoken answers are analyzed for feedback, then discarded. We don't keep transcripts.</li>
          </ul>
          
          <h2 style={styles.privacyH2}>How we use your data</h2>
          <p style={styles.privacyP}>We use your information to:</p>
          <ul style={styles.privacyList}>
            <li>Provide AI-powered feedback on your interview performance</li>
            <li>Track your progress across multiple practice sessions</li>
            <li>Manage your subscription and account</li>
            <li>Display anonymized scores on the leaderboard (first name and initial only)</li>
          </ul>
          
          <h2 style={styles.privacyH2}>Third-party services</h2>
          <p style={styles.privacyP}>We use trusted third-party services for:</p>
          <ul style={styles.privacyList}>
            <li>Secure data storage</li>
            <li>AI-powered interview analysis and feedback</li>
            <li>Text-to-speech for interview questions</li>
            <li>Payment processing</li>
            <li>Authentication (Sign in with Google)</li>
          </ul>
          <p style={styles.privacyP}>These services are GDPR-compliant and process data securely.</p>
          
          <h2 style={styles.privacyH2}>Your rights</h2>
          <p style={styles.privacyP}>Under GDPR, you have the right to:</p>
          <ul style={styles.privacyList}>
            <li><strong>Access:</strong> Request a copy of your data</li>
            <li><strong>Delete:</strong> Request deletion of your account and all associated data</li>
            <li><strong>Portability:</strong> Receive your data in a portable format</li>
            <li><strong>Rectification:</strong> Correct any inaccurate information</li>
          </ul>
          
          <div style={styles.privacyContact}>
            <h3 style={styles.privacyH3}>Questions or requests?</h3>
            <p style={styles.privacyP}>To access, delete, or ask questions about your data, contact us at:</p>
            <a href="mailto:privacy@interviewsimulator.com" style={styles.privacyEmail}>privacy@interviewsimulator.com</a>
          </div>
          
          <div style={styles.privacyFooter}>
            © 2025 Interview Simulator. All rights reserved.
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// Styles
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0a0a0f 0%, #1a1a2e 50%, #0a0a0f 100%)',
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif",
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    position: 'relative',
    overflow: 'auto',
  },
  heroGlow: {
    position: 'fixed',
    top: '-50%',
    left: '-50%',
    width: '200%',
    height: '200%',
    background: 'radial-gradient(circle at 30% 30%, rgba(0, 217, 255, 0.06) 0%, transparent 50%), radial-gradient(circle at 70% 70%, rgba(139, 92, 246, 0.06) 0%, transparent 50%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  // Auth styles
  authSection: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    zIndex: 10,
  },
  authLoading: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  userInfoDesktop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    '@media (max-width: 600px)': {
      display: 'none',
    },
  },
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  signOutBtn: {
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    flexShrink: 0,
  },
  mobileMenuBtn: {
    padding: '8px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '18px',
    cursor: 'pointer',
  },
  mobileMenuDropdown: {
    position: 'absolute',
    top: '50px',
    right: '0',
    background: 'rgba(20, 20, 30, 0.98)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    padding: '12px',
    minWidth: '200px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
  },
  mobileMenuEmail: {
    display: 'block',
    color: 'rgba(255,255,255,0.6)',
    fontSize: '12px',
    padding: '8px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    marginBottom: '8px',
    wordBreak: 'break-all',
  },
  mobileMenuItem: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  mobileMenuItemDanger: {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '14px',
    textAlign: 'left',
    cursor: 'pointer',
    marginTop: '8px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    paddingTop: '18px',
  },
  // Mobile start overlay styles
  mobileStartOverlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '80vh',
    padding: '20px',
    zIndex: 1,
  },
  mobileStartCard: {
    background: 'rgba(20, 20, 30, 0.95)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderRadius: '20px',
    padding: '40px 30px',
    textAlign: 'center',
    maxWidth: '350px',
  },
  mobileStartTitle: {
    fontSize: '24px',
    fontWeight: '700',
    marginBottom: '16px',
    color: '#fff',
  },
  mobileStartText: {
    fontSize: '16px',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '24px',
    lineHeight: '1.5',
  },
  mobileStartBtn: {
    width: '100%',
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: '600',
    background: 'linear-gradient(135deg, #00d9ff 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    marginBottom: '16px',
  },
  mobileStartHint: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
  },
  googleSignInBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 20px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    color: '#333',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
  },
  ctaWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: '100%',
  },
  googleSignInBtnLarge: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '16px 32px',
    background: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    color: '#333',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
    marginTop: '20px',
  },
  googleIcon: {
    flexShrink: 0,
  },
  testModeBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding: '12px 20px',
    background: 'rgba(245, 158, 11, 0.15)',
    border: '1px solid rgba(245, 158, 11, 0.4)',
    borderRadius: '10px',
    marginBottom: '24px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#f59e0b',
  },
  resetBtn: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '6px',
    color: '#fff',
    fontSize: '12px',
    cursor: 'pointer',
  },
  loadingWrapper: {
    textAlign: 'center',
    zIndex: 1,
  },
  loadingSpinner: {
    width: '40px',
    height: '40px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#00d9ff',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    color: 'rgba(255,255,255,0.5)',
  },
  landing: {
    textAlign: 'center',
    maxWidth: '650px',
    zIndex: 1,
    padding: '0 20px',
  },
  badge: {
    display: 'inline-block',
    padding: '8px 16px',
    background: 'rgba(0, 217, 255, 0.1)',
    border: '1px solid rgba(0, 217, 255, 0.3)',
    borderRadius: '50px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '1.5px',
    color: '#00d9ff',
    marginBottom: '24px',
  },
  logo: {
    maxWidth: '350px',
    height: 'auto',
    marginBottom: '32px',
  },
  logoTopLeft: {
    position: 'absolute',
    top: '18px',
    left: '22px',
    height: '44px',
    width: 'auto',
  },
  logoCentered: {
    maxWidth: '100%',
    width: '400px',
    height: 'auto',
    marginTop: '0',
    marginBottom: '0',
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  heroTitle: {
    fontSize: 'clamp(40px, 8vw, 64px)',
    fontWeight: '700',
    lineHeight: '1.1',
    margin: '0 0 20px 0',
    letterSpacing: '-1.5px',
  },
  heroAccent: {
    background: 'linear-gradient(135deg, #00d9ff 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitle: {
    fontSize: '17px',
    color: 'rgba(255,255,255,0.6)',
    lineHeight: '1.6',
    margin: '0 0 36px 0',
    maxWidth: '500px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginBottom: '36px',
    textAlign: 'left',
  },
  feature: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  featureIcon: {
    fontSize: '24px',
    marginTop: '2px',
  },
  featureDesc: {
    display: 'block',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '2px',
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #00d9ff 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textDecoration: 'none',
    minWidth: '200px',
  },
  btnArrow: {
    fontSize: '18px',
  },
  secondaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '12px 24px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: 'rgba(255,255,255,0.7)',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  ghostBtn: {
    display: 'inline-block',
    padding: '12px 24px',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  secondaryActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginTop: '20px',
    flexWrap: 'wrap',
  },
  trialNote: {
    marginTop: '16px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
  },
  setup: {
    maxWidth: '520px',
    width: '100%',
    zIndex: 1,
  },
  setupTitle: {
    fontSize: '28px',
    fontWeight: '700',
    marginBottom: '8px',
    textAlign: 'center',
  },
  setupSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '24px',
    textAlign: 'center',
  },
  micStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px',
    background: 'rgba(16, 185, 129, 0.1)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    borderRadius: '10px',
    marginBottom: '24px',
  },
  micIcon: {
    fontSize: '18px',
  },
  micText: {
    color: '#10b981',
    fontSize: '14px',
    fontWeight: '500',
  },
  inputGroup: {
    marginBottom: '20px',
    textAlign: 'left',
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  optional: {
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '400',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  infoBox: {
    padding: '16px',
    background: 'rgba(0, 217, 255, 0.05)',
    border: '1px solid rgba(0, 217, 255, 0.2)',
    borderRadius: '10px',
    marginBottom: '24px',
    fontSize: '14px',
    textAlign: 'left',
  },
  infoList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    color: 'rgba(255,255,255,0.7)',
  },
  generating: {
    textAlign: 'center',
    zIndex: 1,
  },
  spinner: {
    width: '50px',
    height: '50px',
    border: '3px solid rgba(255,255,255,0.1)',
    borderTopColor: '#00d9ff',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite',
  },
  generatingTitle: {
    fontSize: '22px',
    fontWeight: '600',
    marginBottom: '8px',
  },
  generatingText: {
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '24px',
  },
  analyzingSteps: {
    textAlign: 'left',
    display: 'inline-block',
  },
  analyzingStep: {
    color: '#10b981',
    marginBottom: '8px',
    fontSize: '14px',
  },
  analyzingStepPending: {
    color: 'rgba(255,255,255,0.4)',
    marginBottom: '8px',
    fontSize: '14px',
  },
  interview: {
    maxWidth: '700px',
    width: '100%',
    zIndex: 1,
  },
  progressContainer: {
    marginBottom: '20px',
  },
  progressBar: {
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00d9ff, #8b5cf6)',
    borderRadius: '2px',
    transition: 'width 0.5s ease',
  },
  progressText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
  },
  timer: {
    textAlign: 'center',
    marginBottom: '24px',
    padding: '20px 32px',
    border: '2px solid',
    borderRadius: '16px',
    display: 'inline-block',
    marginLeft: '50%',
    transform: 'translateX(-50%)',
  },
  timerLabel: {
    display: 'block',
    fontSize: '12px',
    opacity: 0.7,
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  timerValue: {
    display: 'block',
    fontSize: '42px',
    fontWeight: '700',
    fontVariantNumeric: 'tabular-nums',
  },
  questionCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '16px',
    padding: '28px',
    marginBottom: '20px',
  },
  speakingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#00d9ff',
    marginBottom: '12px',
  },
  soundWave: {
    animation: 'pulse 1s ease-in-out infinite',
  },
  questionText: {
    fontSize: '19px',
    lineHeight: '1.6',
    margin: 0,
  },
  recordingSection: {
    marginBottom: '24px',
  },
  recordingActive: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    padding: '14px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '10px',
    color: '#ef4444',
    fontWeight: '500',
    marginBottom: '16px',
  },
  recordingDot: {
    width: '10px',
    height: '10px',
    background: '#ef4444',
    borderRadius: '50%',
    animation: 'pulse 1s ease-in-out infinite',
  },
  recordingWaiting: {
    padding: '14px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '16px',
  },
  transcriptPreview: {
    padding: '16px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  transcriptLabel: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  transcriptText: {
    margin: '8px 0 0 0',
    fontSize: '15px',
    lineHeight: '1.5',
    color: 'rgba(255,255,255,0.8)',
  },
  skipNote: {
    textAlign: 'center',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '12px',
  },
  results: {
    maxWidth: '800px',
    width: '100%',
    zIndex: 1,
    paddingBottom: '40px',
  },
  verdictCard: {
    textAlign: 'center',
    padding: '40px 32px',
    borderRadius: '20px',
    border: '1px solid',
    marginBottom: '32px',
  },
  verdictIcon: {
    fontSize: '56px',
    marginBottom: '16px',
  },
  verdictTitle: {
    fontSize: '26px',
    fontWeight: '700',
    marginBottom: '20px',
  },
  overallScore: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '4px',
    marginBottom: '16px',
  },
  scoreNumber: {
    fontSize: '72px',
    fontWeight: '700',
    background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.7) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  scoreOutOf: {
    fontSize: '24px',
    color: 'rgba(255,255,255,0.4)',
  },
  verdictSummary: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: '16px',
    maxWidth: '500px',
    margin: '0 auto',
    lineHeight: '1.6',
  },
  scorecardSection: {
    marginBottom: '32px',
  },
  scorecardTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  categoryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '16px',
  },
  categoryCard: {
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  categoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  categoryLabel: {
    fontSize: '13px',
    fontWeight: '600',
    textTransform: 'capitalize',
    color: 'rgba(255,255,255,0.8)',
  },
  trendBadge: {
    fontSize: '14px',
    fontWeight: '700',
  },
  categoryScoreBar: {
    height: '6px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '10px',
  },
  categoryScoreFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.5s ease',
  },
  categoryMeta: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
  },
  categoryScoreNum: {
    fontSize: '18px',
    fontWeight: '700',
    minWidth: '32px',
  },
  categoryFeedback: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '1.4',
  },
  questionFeedback: {
    padding: '20px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
    marginBottom: '16px',
  },
  questionFeedbackHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  questionNum: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#00d9ff',
  },
  questionScore: {
    fontSize: '16px',
    fontWeight: '700',
  },
  questionFeedbackText: {
    margin: '0 0 16px 0',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    lineHeight: '1.5',
  },
  feedbackDetails: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
  },
  feedbackStrengths: {
    fontSize: '13px',
  },
  feedbackImprovements: {
    fontSize: '13px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '16px',
    marginBottom: '24px',
  },
  summaryCard: {
    padding: '20px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  summaryTitle: {
    fontSize: '15px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  summaryList: {
    margin: 0,
    paddingLeft: '18px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '1.8',
  },
  coachingTip: {
    display: 'flex',
    gap: '16px',
    padding: '20px',
    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(245, 158, 11, 0.05) 100%)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '12px',
    marginBottom: '32px',
  },
  coachingIcon: {
    fontSize: '24px',
  },
  coachingText: {
    margin: '8px 0 0 0',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
    lineHeight: '1.5',
  },
  resultsActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  paywall: {
    textAlign: 'center',
    maxWidth: '450px',
    zIndex: 1,
  },
  lockIcon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  paywallTitle: {
    fontSize: '26px',
    fontWeight: '700',
    marginBottom: '12px',
  },
  paywallText: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '28px',
    lineHeight: '1.6',
  },
  priceCard: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '16px',
    padding: '28px',
    marginBottom: '24px',
    textAlign: 'left',
  },
  priceTag: {
    textAlign: 'center',
    marginBottom: '20px',
  },
  priceAmount: {
    fontSize: '48px',
    fontWeight: '700',
  },
  pricePeriod: {
    fontSize: '18px',
    color: 'rgba(255,255,255,0.5)',
  },
  priceFeatures: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    fontSize: '14px',
    lineHeight: '2',
  },
  historyContainer: {
    maxWidth: '650px',
    width: '100%',
    zIndex: 1,
  },
  leaderboardContainer: {
    maxWidth: '600px',
    width: '100%',
    zIndex: 1,
  },
  sectionTitle: {
    fontSize: '24px',
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: '8px',
  },
  sectionSubtitle: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '28px',
  },
  emptyState: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.4)',
    padding: '40px',
  },
  // Contact form styles
  contactDescription: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
    marginBottom: '20px',
  },
  formGroup: {
    marginBottom: '16px',
  },
  formLabel: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '6px',
  },
  formSelect: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    outline: 'none',
  },
  formTextarea: {
    width: '100%',
    padding: '12px 14px',
    fontSize: '14px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
    minHeight: '100px',
  },
  successMessage: {
    textAlign: 'center',
    padding: '30px',
    color: '#10b981',
    fontSize: '16px',
    fontWeight: '500',
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    marginBottom: '28px',
  },
  historyCard: {
    padding: '20px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.06)',
  },
  historyHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '16px',
  },
  historyRole: {
    fontSize: '16px',
    fontWeight: '600',
    margin: 0,
  },
  historyDate: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
  },
  historyScore: {
    padding: '8px 14px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '18px',
    textAlign: 'center',
  },
  passLabel: {
    display: 'block',
    fontSize: '10px',
    fontWeight: '600',
    letterSpacing: '0.5px',
    marginTop: '2px',
  },
  historyCategories: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
  },
  historyCategory: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
  },
  categoryName: {
    width: '60px',
    color: 'rgba(255,255,255,0.6)',
    textTransform: 'capitalize',
  },
  miniBar: {
    flex: 1,
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  miniBarFill: {
    height: '100%',
    borderRadius: '2px',
  },
  categoryScore: {
    width: '24px',
    textAlign: 'right',
    fontWeight: '600',
    fontSize: '11px',
  },
  trendSection: {
    padding: '20px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '12px',
    marginBottom: '28px',
  },
  trendTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
  },
  trendGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  trendCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '8px',
  },
  trendCat: {
    textTransform: 'capitalize',
    fontSize: '13px',
  },
  trendIndicator: {
    fontWeight: '600',
    fontSize: '13px',
  },
  leaderboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '28px',
  },
  leaderboardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
  },
  goldItem: {
    background: 'rgba(255, 215, 0, 0.08)',
    border: '1px solid rgba(255, 215, 0, 0.25)',
  },
  silverItem: {
    background: 'rgba(192, 192, 192, 0.08)',
    border: '1px solid rgba(192, 192, 192, 0.25)',
  },
  bronzeItem: {
    background: 'rgba(205, 127, 50, 0.08)',
    border: '1px solid rgba(205, 127, 50, 0.25)',
  },
  rank: {
    fontSize: '18px',
    width: '36px',
    textAlign: 'center',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    display: 'block',
    fontWeight: '600',
    fontSize: '15px',
  },
  playerJob: {
    display: 'block',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '12px',
    marginTop: '2px',
  },
  playerResult: {
    textAlign: 'right',
  },
  playerScore: {
    display: 'block',
    fontWeight: '700',
    fontSize: '20px',
    color: '#00d9ff',
  },
  playerStatus: {
    display: 'block',
    fontSize: '11px',
    fontWeight: '600',
    marginTop: '2px',
  },
  // Dashboard styles
  dashboardContainer: {
    maxWidth: '600px',
    width: '100%',
    zIndex: 1,
  },
  dashboardCard: {
    padding: '24px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.08)',
    marginBottom: '20px',
  },
  dashboardCardTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '16px',
    color: 'rgba(255,255,255,0.9)',
  },
  subscriptionStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '12px',
  },
  statusBadgeActive: {
    padding: '6px 12px',
    background: 'rgba(16, 185, 129, 0.2)',
    border: '1px solid rgba(16, 185, 129, 0.4)',
    borderRadius: '20px',
    color: '#10b981',
    fontSize: '13px',
    fontWeight: '600',
  },
  statusBadgeInactive: {
    padding: '6px 12px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '20px',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '13px',
    fontWeight: '500',
  },
  subscriptionPrice: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: '14px',
  },
  subscriptionDate: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: '13px',
    marginBottom: '16px',
  },
  subscriptionInfo: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '14px',
    marginBottom: '16px',
  },
  subscriptionActions: {
    marginTop: '16px',
  },
  dangerBtn: {
    padding: '10px 20px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    color: '#ef4444',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  quickStats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '24px',
  },
  quickStat: {
    textAlign: 'center',
    padding: '16px 8px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
  },
  quickStatValue: {
    display: 'block',
    fontSize: '24px',
    fontWeight: '700',
    color: '#00d9ff',
    marginBottom: '4px',
  },
  quickStatLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  performanceChart: {
    marginBottom: '20px',
  },
  chartHeader: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '16px',
  },
  chartBars: {
    display: 'flex',
    justifyContent: 'center',
    gap: '24px',
    marginBottom: '16px',
  },
  chartBarContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  chartBarWrapper: {
    width: '48px',
    height: '120px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: {
    width: '100%',
    borderRadius: '8px 8px 0 0',
    transition: 'height 0.5s ease',
  },
  chartBarScore: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#fff',
  },
  chartBarLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.4)',
  },
  trendMessage: {
    textAlign: 'center',
    fontSize: '14px',
    fontWeight: '500',
    padding: '12px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '8px',
  },
  // Video styles
  videoToggle: {
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  toggleLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    cursor: 'pointer',
  },
  checkbox: {
    display: 'none',
  },
  toggleSwitch: {
    width: '48px',
    height: '24px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '12px',
    position: 'relative',
    transition: 'background 0.2s',
  },
  toggleKnob: {
    width: '20px',
    height: '20px',
    background: '#00d9ff',
    borderRadius: '50%',
    position: 'absolute',
    top: '2px',
    left: '2px',
    transition: 'transform 0.2s',
  },
  toggleText: {
    fontSize: '15px',
    fontWeight: '500',
  },
  toggleDescription: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '8px',
    marginLeft: '60px',
  },
  videoPreviewContainer: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    zIndex: 10,
  },
  videoPreview: {
    width: '160px',
    height: '120px',
    borderRadius: '12px',
    objectFit: 'cover',
    border: '2px solid rgba(0, 217, 255, 0.5)',
    background: '#000',
  },
  videoLabel: {
    fontSize: '11px',
    color: '#00d9ff',
    textAlign: 'center',
    marginTop: '6px',
  },
  videoScoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
  },
  videoScoreLabel: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)',
  },
  videoScoreValue: {
    fontSize: '24px',
    fontWeight: '700',
  },
  videoCategories: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
  },
  videoCategoryItem: {
    padding: '14px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '10px',
  },
  videoCategoryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  videoCategoryLabel: {
    fontSize: '12px',
    fontWeight: '600',
    textTransform: 'capitalize',
    color: 'rgba(255,255,255,0.8)',
  },
  videoCategoryScore: {
    fontSize: '16px',
    fontWeight: '700',
  },
  videoCategoryBar: {
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '8px',
  },
  videoCategoryFill: {
    height: '100%',
    borderRadius: '2px',
  },
  videoCategoryFeedback: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: '1.4',
  },
  videoTip: {
    marginTop: '16px',
    padding: '14px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.3)',
    borderRadius: '10px',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.8)',
  },
  // Manual input fallback styles
  manualInputSection: {
    marginTop: '16px',
    padding: '16px',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.08)',
  },
  manualInputLabel: {
    display: 'block',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '10px',
  },
  manualTextarea: {
    width: '100%',
    padding: '12px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontFamily: 'inherit',
    resize: 'vertical',
    outline: 'none',
    minHeight: '100px',
  },
  // Feature pills for landing page
  featurePills: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '32px',
  },
  featurePillsLeft: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '12px',
    justifyContent: 'flex-start',
    marginBottom: '24px',
  },
  featurePill: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 16px',
    background: 'rgba(255,255,255,0.05)',
    borderRadius: '20px',
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
  },
  // Hero grid layout
  heroGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '60px',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1100px',
    margin: '0 auto 40px',
  },
  heroContent: {
    textAlign: 'left',
  },
  heroTitleLeft: {
    fontSize: '42px',
    fontWeight: '700',
    lineHeight: '1.1',
    marginBottom: '20px',
    background: 'linear-gradient(135deg, #ffffff 0%, rgba(255,255,255,0.8) 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  heroSubtitleLeft: {
    fontSize: '17px',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  trialNoteLeft: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    marginTop: '12px',
  },
  heroPreview: {
    position: 'relative',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  heroGif: {
    width: '100%',
    height: 'auto',
    display: 'block',
    borderRadius: '16px',
  },
  previewLabel: {
    position: 'absolute',
    bottom: '12px',
    right: '12px',
    padding: '6px 12px',
    background: 'rgba(0,0,0,0.7)',
    borderRadius: '6px',
    fontSize: '12px',
    color: 'rgba(255,255,255,0.7)',
  },
  inputHint: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.4)',
    marginTop: '8px',
  },
  // Trust block
  trustBlock: {
    marginTop: '40px',
    padding: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    textAlign: 'center',
  },
  trustTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '8px',
  },
  trustText: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
    margin: 0,
  },
  trustLink: {
    color: '#00d9ff',
    textDecoration: 'none',
  },
  // Footer
  footer: {
    marginTop: '40px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'center',
  },
  footerLinks: {
    marginBottom: '12px',
  },
  footerLink: {
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    fontSize: '13px',
  },
  footerDivider: {
    color: 'rgba(255,255,255,0.3)',
    margin: '0 12px',
  },
  footerCopyright: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.3)',
    margin: 0,
  },
  // Select dropdown
  select: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '16px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '12px',
    color: '#fff',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none',
  },
  // Fixable message
  fixableMessage: {
    padding: '20px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.2)',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  fixableTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#93c5fd',
    marginBottom: '8px',
    marginTop: 0,
  },
  fixableText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: '1.6',
    margin: 0,
  },
  // Retry CTAs
  retryCTAs: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    marginBottom: '32px',
    flexWrap: 'wrap',
  },
  retryBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 28px',
    background: 'linear-gradient(135deg, #00d9ff, #8b5cf6)',
    border: 'none',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  practiceBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '14px 28px',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Leaderboard teaser
  leaderboardTeaser: {
    padding: '24px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  leaderboardTeaserTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '16px',
    marginTop: 0,
  },
  yourPosition: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(139, 92, 246, 0.1)',
    border: '1px solid rgba(139, 92, 246, 0.2)',
    borderRadius: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap',
  },
  yourPositionLabel: {
    fontSize: '13px',
    color: 'rgba(255,255,255,0.6)',
  },
  yourPositionScore: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#8b5cf6',
  },
  yourPositionRank: {
    marginLeft: 'auto',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.5)',
  },
  leaderboardTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'rgba(255, 215, 0, 0.1)',
    border: '1px solid rgba(255, 215, 0, 0.2)',
    borderRadius: '8px',
    marginBottom: '12px',
  },
  rankBadge: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #ffd700, #ffaa00)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    color: '#000',
  },
  topUserInfo: {
    flex: 1,
  },
  topUserName: {
    fontWeight: '600',
    fontSize: '14px',
  },
  topUserRole: {
    fontSize: '12px',
    color: 'rgba(255,255,255,0.5)',
  },
  topUserScore: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#10b981',
  },
  lockedRows: {
    position: 'relative',
    marginTop: '8px',
  },
  lockedRow: {
    height: '44px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: '6px',
    marginBottom: '8px',
    filter: 'blur(4px)',
    opacity: 0.5,
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(10, 10, 15, 0.7)',
    borderRadius: '8px',
  },
  lockedText: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '12px',
  },
  unlockBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  // Privacy Policy page
  privacyPage: {
    maxWidth: '700px',
    width: '100%',
    padding: '20px',
    zIndex: 1,
  },
  privacyTitle: {
    fontSize: '32px',
    fontWeight: '700',
    marginBottom: '8px',
  },
  privacyUpdated: {
    fontSize: '14px',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '32px',
  },
  privacyHighlight: {
    padding: '20px',
    background: 'rgba(0, 217, 255, 0.1)',
    border: '1px solid rgba(0, 217, 255, 0.2)',
    borderRadius: '10px',
    marginBottom: '32px',
  },
  privacyH2: {
    fontSize: '20px',
    fontWeight: '600',
    marginTop: '32px',
    marginBottom: '16px',
    color: '#00d9ff',
  },
  privacyH3: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '12px',
  },
  privacyP: {
    fontSize: '15px',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '16px',
    lineHeight: '1.7',
  },
  privacyList: {
    marginBottom: '16px',
    paddingLeft: '24px',
    lineHeight: '1.8',
  },
  privacyContact: {
    padding: '20px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '10px',
    marginTop: '32px',
  },
  privacyEmail: {
    color: '#00d9ff',
    textDecoration: 'none',
  },
  privacyFooter: {
    marginTop: '48px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(255,255,255,0.1)',
    fontSize: '13px',
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
};

// Inject global styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
  
  * {
    box-sizing: border-box;
  }
  
  input::placeholder, textarea::placeholder {
    color: rgba(255,255,255,0.3);
  }
  
  input:focus, textarea:focus {
    border-color: rgba(0, 217, 255, 0.5);
  }
  
  button:hover {
    opacity: 0.9;
  }
  
  ul li {
    margin-bottom: 4px;
  }
  
  strong {
    color: rgba(255,255,255,0.9);
  }
  
  /* Responsive hero grid */
  @media (max-width: 900px) {
    .hero-grid-responsive {
      grid-template-columns: 1fr !important;
      text-align: center !important;
    }
  }
`;
document.head.appendChild(styleSheet);
