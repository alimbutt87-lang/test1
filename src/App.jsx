import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';

// ===== CONFIGURATION =====
// Set to true for testing (bypasses paywall), false for production
const TEST_MODE = false;

// Stripe URLs
const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/fZu14n8Ac7Wm3QJ0TN6wE00';
const STRIPE_SUBSCRIBE_URL = 'https://buy.stripe.com/fZu14n8Ac7Wm3QJ0TN6wE00';

// Supabase configuration
const SUPABASE_URL = 'https://msngeennlvzbhohnrhnq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable__01NFWdOHHofya6dz2CLhg_XFBWE8sQ';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
  
  const timerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const speechSynthRef = useRef(null);
  const audioRef = useRef(null);
  
  // Video refs
  const videoRef = useRef(null);
  const videoStreamRef = useRef(null);
  const snapshotIntervalRef = useRef(null);
  const transcriptRef = useRef(''); // Store transcript in ref for reliable access

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
  }, [stage, videoEnabled]);

  // Load user data from Supabase
  const loadUserData = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (data) {
        setCompletedInterviews(data.completed_interviews || 0);
        setIsSubscribed(data.is_subscribed || false);
        setSubscriptionDate(data.subscription_date);
      } else if (error && error.code === 'PGRST116') {
        // User doesn't exist in our table yet, create them
        await supabase.from('user_profiles').insert({
          id: userId,
          completed_interviews: 0,
          is_subscribed: false
        });
      }
    } catch (e) {
      console.error('Error loading user data:', e);
    }
  };

  // Sign in with Google
  const signInWithGoogle = async () => {
    // Track sign-in attempt
    if (window.mixpanel) {
      window.mixpanel.track('google_sign_in_clicked');
    }
    
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
            price: 9.99,
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
        setLeaderboard(JSON.parse(stored));
      }
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
        setCurrentTranscript(transcript);
        transcriptRef.current = transcript; // Also store in ref for reliable access
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
          setMicPermission(false);
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
        
        audio.play().catch((e) => {
          console.error('Audio play() error:', e);
          setIsSpeaking(false);
          fallbackSpeak(text).then(resolve);
        });
      });
      
    } catch (error) {
      console.error('ElevenLabs error, falling back to browser voice:', error);
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
    setVideoSnapshots([]); // Reset snapshots for new interview
    setVideoFeedback(null);
    
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
      
      // Speak introduction then first question
      await speakQuestion(`Welcome to your interview for the ${jobTitle} position. I'll be asking you 5 questions. You have 3 minutes to answer each question. Please speak clearly and take your time. Let's begin.`);
      await speakQuestion(`Question 1: ${parsedQuestions[0]}`);
      startRecordingPhase();
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
      
      await speakQuestion(`Welcome to your interview. Let's begin with question 1: ${fallback[0]}`);
      startRecordingPhase();
    }
  };

  const startRecordingPhase = () => {
    setTimeLeft(180); // Always reset to 3 minutes
    setIsTimerRunning(true);
    // Don't clear transcript here - it's already cleared in handleNextQuestion
    startRecording();
  };

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (e) {
        console.error('Failed to start recognition:', e);
      }
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsRecording(false);
      } catch (e) {}
    }
  };

  // Timer logic
  useEffect(() => {
    if (isTimerRunning && timeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && isTimerRunning) {
      handleNextQuestion();
    }
    return () => clearTimeout(timerRef.current);
  }, [isTimerRunning, timeLeft]);

  const handleNextQuestion = async () => {
    setIsTimerRunning(false);
    stopRecording();
    
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
    
    const newAnswer = {
      question: questions[currentQuestionIndex],
      answer: capturedTranscript,
      timeSpent: 180 - timeLeft,
      questionIndex: currentQuestionIndex
    };
    
    const newAnswers = [...answers, newAnswer];
    setAnswers(newAnswers);
    
    // Clear transcript state AND ref
    setCurrentTranscript('');
    transcriptRef.current = '';
    
    // Reset timer immediately for next question
    setTimeLeft(180);
    
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      setCurrentQuestionIndex(nextIndex);
      
      await speakQuestion(`Question ${nextIndex + 1}: ${questions[nextIndex]}`);
      startRecordingPhase();
    } else {
      // Interview complete - analyze answers
      setStage('analyzing');
      setIsAnalyzing(true);
      await analyzeAllAnswers(newAnswers);
    }
  };

  // AI Analysis of all answers using serverless function
  const analyzeAllAnswers = async (allAnswers) => {
    try {
      const response = await fetch('/api/analyze-interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: allAnswers, jobTitle })
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
      
      if (userName) {
        await saveToLeaderboard(userName, results.overallScore, jobTitle, results.passed);
      }
      
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

  const generateFallbackResults = (allAnswers) => {
    const avgLength = allAnswers.reduce((sum, a) => sum + a.answer.length, 0) / allAnswers.length;
    const avgTime = allAnswers.reduce((sum, a) => sum + a.timeSpent, 0) / allAnswers.length;
    const baseScore = Math.min(Math.round((avgLength / 500) * 50 + (avgTime / 180) * 30 + 20), 85);
    
    return {
      overallScore: baseScore,
      passed: baseScore >= 70,
      verdict: baseScore >= 70 ? "Congratulations! You got the job!" : "Unfortunately, you did not pass this interview.",
      summary: "Your interview has been evaluated. Review the detailed feedback below.",
      questionScores: allAnswers.map((a, i) => ({
        questionNum: i + 1,
        score: Math.round(baseScore + (Math.random() - 0.5) * 20),
        feedback: "Answer recorded and evaluated.",
        strengths: ["Attempted the question"],
        improvements: ["Provide more specific examples"]
      })),
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

  const handleStartInterview = async () => {
    // In TEST_MODE, always allow access
    // In production, check if user is subscribed or has free trial remaining
    if (!TEST_MODE && !isSubscribed && completedInterviews >= 1) {
      setStage('paywall');
      return;
    }
    
    // Reset form and interview state for new interview
    setJobTitle('');
    setJobDescription('');
    setUserName('');
    setQuestions([]);
    setCurrentQuestionIndex(0);
    setAnswers([]);
    setCurrentTranscript('');
    setFinalResults(null);
    setTimeLeft(180);
    setVideoSnapshots([]);
    setVideoFeedback(null);
    
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

  // Landing Page
  if (stage === 'landing') {
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.landing}>
          {/* User auth section - top right (only show when logged in) */}
          {user && (
            <div style={styles.authSection}>
              <div style={styles.userInfo}>
                <span style={styles.userEmail}>👤 {user.email}</span>
                <button style={styles.signOutBtn} onClick={signOut}>Sign Out</button>
              </div>
            </div>
          )}
          
          {TEST_MODE && (
            <div style={styles.testModeBanner}>
              🧪 TEST MODE - Paywall disabled
              <button style={styles.resetBtn} onClick={resetAllData}>Reset Data</button>
            </div>
          )}
          
          <div style={styles.badge}>INTERVIEW SIMULATOR</div>
          <h1 style={styles.heroTitle}>
            No surprises.<br />
            <span style={styles.heroAccent}>Ace your interview.</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Enter your role and job description. We simulate a real interview with timed, 
            camera-on answers — then score both what you say and how you say it.
          </p>
          
          <div style={styles.featurePills}>
            <div style={styles.featurePill}>
              <span>⏱️</span>
              <span>3-min timed answers</span>
            </div>
            <div style={styles.featurePill}>
              <span>📹</span>
              <span>Camera-on pressure</span>
            </div>
            <div style={styles.featurePill}>
              <span>✅</span>
              <span>Pass/Fail verdict</span>
            </div>
            <div style={styles.featurePill}>
              <span>📊</span>
              <span>Delivery analysis</span>
            </div>
          </div>

          {/* Main CTA - changes based on auth state */}
          {!user && !TEST_MODE ? (
            <div style={styles.ctaWrapper}>
              <button style={styles.googleSignInBtnLarge} onClick={signInWithGoogle}>
                <svg style={styles.googleIcon} viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in to Start Free Interview
              </button>
              <p style={styles.trialNote}>🎁 First interview is completely free • No credit card required</p>
            </div>
          ) : (
            <>
              <button style={styles.primaryBtn} onClick={handleStartInterview}>
                {completedInterviews === 0 ? 'Start Free Interview' : 'Start Interview'}
                <span style={styles.btnArrow}>→</span>
              </button>
              
              {completedInterviews === 0 && !TEST_MODE && (
                <p style={styles.trialNote}>🎁 First interview is completely free</p>
              )}
              
              {isSubscribed && (
                <p style={styles.trialNote}>✓ Subscribed • Unlimited interviews</p>
              )}
              
              {!isSubscribed && completedInterviews > 0 && !TEST_MODE && (
                <p style={styles.trialNote}>Free trial used • Subscribe for unlimited access</p>
              )}
            </>
          )}

          {/* Secondary actions - only show when logged in */}
          {user && (
            <div style={styles.secondaryActions}>
              <button style={styles.secondaryBtn} onClick={() => setStage('dashboard')}>
                ⚙️ Dashboard
              </button>
              {pastInterviews.length > 0 && (
                <button style={styles.secondaryBtn} onClick={() => setStage('history')}>
                  📋 History ({pastInterviews.length})
                </button>
              )}
            </div>
          )}
          
          {/* Trust Block */}
          <div style={styles.trustBlock}>
            <p style={styles.trustTitle}>🔒 Your Practice is Private</p>
            <p style={styles.trustText}>
              Video and audio recordings are processed in real-time and never stored. 
              We only save your scores to track progress. <a href="#" onClick={(e) => { e.preventDefault(); setStage('privacy'); }} style={styles.trustLink}>Learn more</a>
            </p>
          </div>
          
          {/* Footer */}
          <div style={styles.footer}>
            <div style={styles.footerLinks}>
              <a href="#" onClick={(e) => { e.preventDefault(); setStage('privacy'); }} style={styles.footerLink}>Privacy Policy</a>
              <span style={styles.footerDivider}>•</span>
              <a href="mailto:support@interviewsimulator.com" style={styles.footerLink}>Contact</a>
            </div>
            <p style={styles.footerCopyright}>© 2025 Interview Simulator. All rights reserved.</p>
          </div>
        </div>
      </div>
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
    };
    
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.paywall}>
          <div style={styles.lockIcon}>🔒</div>
          <h2 style={styles.paywallTitle}>Your free trial has ended</h2>
          <p style={styles.paywallText}>
            Unlock unlimited practice interviews and keep improving until you land your dream job.
          </p>
          
          <div style={styles.priceCard}>
            <div style={styles.priceTag}>
              <span style={styles.priceAmount}>$9.99</span>
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
            <a 
              href={STRIPE_SUBSCRIBE_URL}
              target="_blank" 
              rel="noopener noreferrer"
              style={styles.primaryBtn}
              onClick={handleSubscribeClick}
            >
              Subscribe Now
              <span style={styles.btnArrow}>→</span>
            </a>
          )}
          
          <button style={styles.ghostBtn} onClick={() => setStage('landing')}>
            ← Back to home
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
                  <span style={styles.subscriptionPrice}>$9.99/month</span>
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
                <button style={styles.primaryBtn} onClick={() => setStage('paywall')}>
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

                <button style={styles.secondaryBtn} onClick={() => setStage('history')}>
                  View Detailed History
                </button>
              </div>
            )}
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
          
          <button style={styles.secondaryBtn} onClick={() => setStage('landing')}>
            ← Back to home
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
              {leaderboard.slice(0, 10).map((entry, index) => (
                <div key={index} style={{
                  ...styles.leaderboardItem,
                  ...(index === 0 ? styles.goldItem : index === 1 ? styles.silverItem : index === 2 ? styles.bronzeItem : {})
                }}>
                  <span style={styles.rank}>
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                  </span>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>{entry.name}</span>
                    <span style={styles.playerJob}>{entry.job}</span>
                  </div>
                  <div style={styles.playerResult}>
                    <span style={styles.playerScore}>{entry.score}</span>
                    <span style={{
                      ...styles.playerStatus,
                      color: entry.passed ? '#10b981' : '#ef4444'
                    }}>
                      {entry.passed ? '✓ Passed' : '✗ Failed'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <button style={styles.secondaryBtn} onClick={() => setStage('landing')}>
            ← Back to home
          </button>
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
            <label style={styles.label}>Job Description <span style={styles.optional}>(optional but recommended)</span></label>
            <textarea
              style={styles.textarea}
              placeholder="Paste the job description here for more tailored questions..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={5}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Your Name <span style={styles.optional}>(for leaderboard)</span></label>
            <input
              type="text"
              style={styles.input}
              placeholder="e.g. Alex"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Country <span style={styles.optional}>(for leaderboard)</span></label>
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
                onChange={(e) => setVideoEnabled(e.target.checked)}
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
            onClick={() => jobTitle.trim() && generateQuestions()}
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
            <p style={styles.questionText}>{questions[currentQuestionIndex]}</p>
          </div>
          
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
          </div>
          
          <button 
            style={{
              ...styles.primaryBtn,
              opacity: isSpeaking ? 0.5 : 1,
              cursor: isSpeaking ? 'not-allowed' : 'pointer'
            }} 
            onClick={handleNextQuestion}
            disabled={isSpeaking}
          >
            {isSpeaking ? 'Please wait...' : (currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Interview')}
            <span style={styles.btnArrow}>→</span>
          </button>
          
          <p style={styles.skipNote}>{isSpeaking ? 'Wait for AI to finish speaking' : 'Click above when you\'re done answering, or wait for the timer'}</p>
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
    // Calculate percentile (comparing to all users)
    const calculatePercentile = () => {
      const allScores = leaderboard.map(l => l.score);
      if (allScores.length === 0) return 50;
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
              You scored higher than {percentile}% of candidates
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
              handleStartInterview();
            }}>
              🔁 Retry Interview
            </button>
            <button style={styles.practiceBtn} onClick={() => setStage('landing')}>
              🏠 Back to Home
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
                  <span style={{...styles.questionScore, color: getScoreColor(q.score)}}>
                    {q.score}/100
                  </span>
                </div>
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
              <span style={styles.yourPositionRank}>Higher than {percentile}% of candidates</span>
            </div>
            
            {/* #1 visible */}
            {leaderboard.length > 0 && (
              <div style={styles.leaderboardTop}>
                <div style={styles.rankBadge}>1</div>
                <div style={styles.topUserInfo}>
                  <div style={styles.topUserName}>{leaderboard[0].flag || '🌍'} {leaderboard[0].name}</div>
                  <div style={styles.topUserRole}>{leaderboard[0].role || 'Interview Champion'}</div>
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
                  <button style={styles.unlockBtn} onClick={() => setStage('paywall')}>
                    🔓 Unlock with Pro
                  </button>
                </div>
              </div>
            )}
            
            {isSubscribed && (
              <button style={styles.secondaryBtn} onClick={() => setStage('leaderboard')}>
                View Full Leaderboard
              </button>
            )}
          </div>

          {/* Bottom Actions */}
          <div style={styles.resultsActions}>
            <button style={styles.secondaryBtn} onClick={() => setStage('history')}>
              📋 View Progress History
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
  userEmail: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: '14px',
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
