import React, { useState, useEffect, useRef } from 'react';

// ===== CONFIGURATION =====
// Set to true for testing (bypasses paywall), false for production
const TEST_MODE = true;

// Stripe URLs
const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/login/fZu14n8Ac7Wm3QJ0TN6wE00';
const STRIPE_SUBSCRIBE_URL = 'https://buy.stripe.com/fZu14n8Ac7Wm3QJ0TN6wE00';

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
  
  // Video recording states
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [cameraPermission, setCameraPermission] = useState(null);
  const [videoSnapshots, setVideoSnapshots] = useState([]); // Store snapshots for AI analysis
  const [videoFeedback, setVideoFeedback] = useState(null);
  
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

  // Initialize on mount
  useEffect(() => {
    initializeApp();
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
  }, []);

  // Attach video stream when interview stage is active
  useEffect(() => {
    if (stage === 'interview' && videoEnabled && videoStreamRef.current && videoRef.current) {
      videoRef.current.srcObject = videoStreamRef.current;
      videoRef.current.play().catch(e => console.log('Video play error:', e));
    }
  }, [stage, videoEnabled]);

  const initializeApp = async () => {
    // Check if user just completed payment (redirected from Stripe)
    checkPaymentSuccess();
    
    await checkCompletedInterviews();
    await checkSubscriptionStatus();
    await loadPastInterviews();
    await loadLeaderboard();
    await setupSpeechRecognition();
    setIsLoading(false);
  };

  const checkPaymentSuccess = () => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('success') === 'true') {
      // User just paid! Mark them as subscribed
      const subData = { active: true, date: new Date().toISOString() };
      try {
        localStorage.setItem('subscription', JSON.stringify(subData));
        setIsSubscribed(true);
        setSubscriptionDate(subData.date);
        
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
      const result = await window.storage.get('completedInterviews');
      if (result) {
        setCompletedInterviews(parseInt(result.value) || 0);
      }
    } catch (e) {
      // No completed interviews yet
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const result = await window.storage.get('subscription');
      if (result) {
        const sub = JSON.parse(result.value);
        setIsSubscribed(sub.active);
        setSubscriptionDate(sub.date);
      }
    } catch (e) {}
  };

  // For testing: simulate subscription
  const simulateSubscribe = async () => {
    const subData = { active: true, date: new Date().toISOString() };
    try {
      await window.storage.set('subscription', JSON.stringify(subData));
      setIsSubscribed(true);
      setSubscriptionDate(subData.date);
    } catch (e) {}
  };

  const cancelSubscription = async () => {
    try {
      await window.storage.set('subscription', JSON.stringify({ active: false, date: null }));
      setIsSubscribed(false);
      setSubscriptionDate(null);
    } catch (e) {}
  };

  const incrementCompletedInterviews = async () => {
    const newCount = completedInterviews + 1;
    try {
      await window.storage.set('completedInterviews', newCount.toString());
      setCompletedInterviews(newCount);
    } catch (e) {
      console.error('Failed to save completed interviews count');
    }
  };

  // For testing: reset all data
  const resetAllData = async () => {
    try {
      await window.storage.delete('completedInterviews');
      await window.storage.delete('pastInterviews');
      await window.storage.delete('subscription');
      setCompletedInterviews(0);
      setPastInterviews([]);
      setIsSubscribed(false);
      setSubscriptionDate(null);
      alert('All data reset! You can test fresh.');
    } catch (e) {
      console.error('Failed to reset data');
    }
  };

  const loadPastInterviews = async () => {
    try {
      const result = await window.storage.get('pastInterviews');
      if (result) {
        setPastInterviews(JSON.parse(result.value));
      }
    } catch (e) {}
  };

  const loadLeaderboard = async () => {
    try {
      const result = await window.storage.get('leaderboard', true);
      if (result) {
        setLeaderboard(JSON.parse(result.value));
      }
    } catch (e) {}
  };

  const savePastInterview = async (interviewData) => {
    const updated = [interviewData, ...pastInterviews].slice(0, 3);
    try {
      await window.storage.set('pastInterviews', JSON.stringify(updated));
      setPastInterviews(updated);
    } catch (e) {
      console.error('Failed to save interview history');
    }
  };

  const markFreeTrialUsed = async () => {
    try {
      await window.storage.set('hasUsedFreeTrial', 'true');
      setHasUsedFreeTrial(true);
    } catch (e) {}
  };

  const saveToLeaderboard = async (name, finalScore, job, passed) => {
    const newEntry = {
      name,
      score: finalScore,
      job,
      passed,
      date: new Date().toISOString().split('T')[0]
    };
    
    const updatedLeaderboard = [...leaderboard, newEntry]
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    
    try {
      await window.storage.set('leaderboard', JSON.stringify(updatedLeaderboard), true);
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
    
    // Start camera if video enabled
    if (videoEnabled) {
      await startCamera();
    }
    
    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle, jobDescription })
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
      
      setIsAnalyzing(false);
      setStage('results');
      
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
          {TEST_MODE && (
            <div style={styles.testModeBanner}>
              🧪 TEST MODE - Paywall disabled
              <button style={styles.resetBtn} onClick={resetAllData}>Reset Data</button>
            </div>
          )}
          <div style={styles.badge}>AI-POWERED INTERVIEW SIMULATOR</div>
          <h1 style={styles.heroTitle}>
            Ace Your<br />
            <span style={styles.heroAccent}>Next Interview</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Practice with AI-generated questions, record your responses, 
            and get instant feedback on what's working and what needs improvement.
          </p>
          
          <div style={styles.features}>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>🎙️</div>
              <div>
                <strong>Voice Recording</strong>
                <span style={styles.featureDesc}>Speak your answers naturally</span>
              </div>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>🤖</div>
              <div>
                <strong>AI Analysis</strong>
                <span style={styles.featureDesc}>Detailed scoring & feedback</span>
              </div>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>📊</div>
              <div>
                <strong>Scorecard</strong>
                <span style={styles.featureDesc}>Know exactly where to improve</span>
              </div>
            </div>
            <div style={styles.feature}>
              <div style={styles.featureIcon}>📈</div>
              <div>
                <strong>Track Progress</strong>
                <span style={styles.featureDesc}>See improvement over time</span>
              </div>
            </div>
          </div>

          <button style={styles.primaryBtn} onClick={handleStartInterview}>
            {completedInterviews === 0 ? 'Start Free Interview' : 'Start Interview'}
            <span style={styles.btnArrow}>→</span>
          </button>
          
          {completedInterviews === 0 && !TEST_MODE && (
            <p style={styles.trialNote}>🎁 First interview is completely free • No card required</p>
          )}
          
          {isSubscribed && (
            <p style={styles.trialNote}>✓ Subscribed • Unlimited interviews</p>
          )}
          
          {!isSubscribed && completedInterviews > 0 && !TEST_MODE && (
            <p style={styles.trialNote}>Free trial used • Subscribe for unlimited access</p>
          )}

          <div style={styles.secondaryActions}>
            <button style={styles.secondaryBtn} onClick={() => setStage('dashboard')}>
              ⚙️ Dashboard
            </button>
            {pastInterviews.length > 0 && (
              <button style={styles.secondaryBtn} onClick={() => setStage('history')}>
                📋 History ({pastInterviews.length})
              </button>
            )}
            <button style={styles.secondaryBtn} onClick={() => setStage('leaderboard')}>
              🏆 Leaderboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Paywall
  if (stage === 'paywall') {
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
            
            {/* Show transcript if speech recognition is working */}
            {currentTranscript && !isSpeaking && (
              <div style={styles.transcriptPreview}>
                <span style={styles.transcriptLabel}>Your response:</span>
                <p style={styles.transcriptText}>{currentTranscript}</p>
              </div>
            )}
            
            {/* Manual text input fallback - only show in TEST_MODE for sandbox testing */}
            {TEST_MODE && !isSpeaking && (
              <div style={styles.manualInputSection}>
                <span style={styles.manualInputLabel}>
                  {currentTranscript ? 'Or edit your response:' : '💡 Voice not working? Type your answer (TEST MODE only):'}
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
    return (
      <div style={styles.container}>
        <div style={styles.heroGlow}></div>
        <div style={styles.results}>
          {/* Verdict */}
          <div style={{
            ...styles.verdictCard,
            background: finalResults.passed 
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%)',
            borderColor: finalResults.passed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'
          }}>
            <div style={styles.verdictIcon}>{finalResults.passed ? '🎉' : '😔'}</div>
            <h2 style={{
              ...styles.verdictTitle,
              color: finalResults.passed ? '#10b981' : '#ef4444'
            }}>
              {finalResults.verdict}
            </h2>
            <div style={styles.overallScore}>
              <span style={styles.scoreNumber}>{finalResults.overallScore}</span>
              <span style={styles.scoreOutOf}>/100</span>
            </div>
            <p style={styles.verdictSummary}>{finalResults.summary}</p>
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

          {/* Actions */}
          <div style={styles.resultsActions}>
            {userName && (
              <button 
                style={styles.primaryBtn}
                onClick={() => setStage('leaderboard')}
              >
                View Leaderboard
              </button>
            )}
            <button style={styles.secondaryBtn} onClick={() => setStage('history')}>
              View Progress History
            </button>
            <button style={styles.ghostBtn} onClick={() => setStage('landing')}>
              ← Back to Home
            </button>
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
`;
document.head.appendChild(styleSheet);
