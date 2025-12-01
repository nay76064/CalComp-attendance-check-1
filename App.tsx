import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserSettings, AttendanceRecord, ViewState } from './types';
import { getSettings, saveSettings, getStoredRecords, saveRecords } from './services/storageService';
import { fetchAttendanceData, transcribeEmployeeId, extractIdFromImage } from './services/geminiService';
import { APP_TITLE, INPUT_PLACEHOLDER } from './constants';
import AttendanceTable from './components/AttendanceTable';
import Settings from './components/Settings';
import { requestNotificationPermission, sendNotification, playAlertSound } from './services/notificationService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.DASHBOARD);
  const [settings, setSettings] = useState<UserSettings>(getSettings());
  const [records, setRecords] = useState<AttendanceRecord[]>(getStoredRecords());
  const [loading, setLoading] = useState(false);
  const [empIdInput, setEmpIdInput] = useState(settings.empId);
  
  // Voice Input States
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  // Camera/Barcode States
  const [showCamera, setShowCamera] = useState(false);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [detectedId, setDetectedId] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isFlashOn, setIsFlashOn] = useState(false);
  const [hasFlash, setHasFlash] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const autoScanIntervalRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isProcessingRef = useRef(false);
  const isConfirmingRef = useRef(false);

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.darkMode]);

  useEffect(() => {
    setEmpIdInput(settings.empId);
  }, [settings.empId]);

  useEffect(() => { isProcessingRef.current = isProcessingImage; }, [isProcessingImage]);
  useEffect(() => { isConfirmingRef.current = isConfirming; }, [isConfirming]);

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  const stopCameraStream = () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track && isFlashOn) {
        track.applyConstraints({ advanced: [{ torch: false } as any] }).catch(() => {});
      }
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (autoScanIntervalRef.current) {
      clearInterval(autoScanIntervalRef.current);
      autoScanIntervalRef.current = null;
    }
    setIsFlashOn(false);
  };

  const toggleDarkMode = () => {
    const newSettings = { ...settings, darkMode: !settings.darkMode };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const parseRecordDate = (dateString: string): Date | null => {
    const parts = dateString.split(' ');
    if (parts.length !== 2) return null;
    const [day, month, year] = parts[0].split('/').map(Number);
    const [hours, minutes, seconds] = parts[1].split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
  };

  const handleCheckAttendance = useCallback(async (isAutoCheck = false) => {
    const targetId = isAutoCheck ? settings.empId : empIdInput;
    
    if (!targetId) {
      if(!isAutoCheck) alert("Please enter an Employee No.");
      return;
    }

    if (!isAutoCheck) setLoading(true);

    try {
      const data = await fetchAttendanceData(targetId);
      
      const sortedData = [...data].sort((a, b) => {
          const dateA = parseRecordDate(a.dateTime);
          const dateB = parseRecordDate(b.dateTime);
          if (dateA && dateB) return dateB.getTime() - dateA.getTime();
          return 0;
      });

      setRecords(sortedData);
      saveRecords(sortedData);
      
      if (!isAutoCheck && targetId !== settings.empId) {
        const newSettings = { ...settings, empId: targetId };
        setSettings(newSettings);
        saveSettings(newSettings);
      }
      
      if (settings.enableSound || isAutoCheck) {
          const now = new Date();
          const todayStr = now.toLocaleDateString('en-GB'); 

          const todayRecords = sortedData.filter(r => {
             const d = r.dateTime.split(' ')[0];
             return d === todayStr;
          });

          const todayRecordsAsc = [...todayRecords].sort((a, b) => {
              const dateA = parseRecordDate(a.dateTime);
              const dateB = parseRecordDate(b.dateTime);
              if (dateA && dateB) return dateA.getTime() - dateB.getTime();
              return 0;
          });

          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          const currentTimeValue = currentHour * 60 + currentMinute;

          const TIME_8_00 = 8 * 60;       
          const TIME_16_40 = 16 * 60 + 40; 

          const morningScan = todayRecordsAsc.find(r => {
            const d = parseRecordDate(r.dateTime);
            return d && d.getHours() < 12; 
          });

          const eveningScan = todayRecordsAsc.find(r => {
             const d = parseRecordDate(r.dateTime);
             if (!d) return false;
             const t = d.getHours() * 60 + d.getMinutes();
             return t >= TIME_16_40; 
          });

          if (isAutoCheck) {
                if (currentTimeValue < 12 * 60) { 
                   if (morningScan) {
                      sendNotification("Morning Check-In", `Confirmed: ${morningScan.dateTime.split(' ')[1]}`);
                      playAlertSound('success', settings.customSound);
                   } else if (currentTimeValue >= TIME_8_00) {
                      sendNotification("Missing Morning Entry!", "It's past 08:00 and no entry found.");
                      playAlertSound('warning');
                   }
                } 
                else if (currentTimeValue >= TIME_16_40) {
                   if (eveningScan) {
                      sendNotification("Work Completed", "You have successfully checked out.");
                      playAlertSound('success', settings.customSound);
                   } else {
                      sendNotification("Missing Checkout!", "It's past 16:40. Don't forget to scan out!");
                      playAlertSound('warning');
                   }
                }
          } else {
             if (todayRecords.length > 0) {
                 playAlertSound('success', settings.customSound);
             }
          }
      }

    } catch (error: any) {
      console.error("App Error:", error);
      if (!isAutoCheck) {
          alert(`Error: ${error.message || "Connection failed"}`);
      }
    } finally {
      if (!isAutoCheck) setLoading(false);
    }
  }, [empIdInput, settings]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const now = new Date();
      const currentDay = now.getDay(); 
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      
      if (settings.checkDays.includes(currentDay)) {
        if (settings.checkTimes.includes(currentTime)) {
          if (now.getSeconds() === 0) {
             console.log(`Auto-checking at ${currentTime}...`);
             handleCheckAttendance(true);
          }
        }
      }
    }, 1000); 

    return () => clearInterval(intervalId);
  }, [settings, handleCheckAttendance]);

  const handleSettingsSave = (newSettings: UserSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
    setView(ViewState.DASHBOARD);
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert("Audio recording is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          setIsProcessingAudio(true);
          try {
            const transcribedId = await transcribeEmployeeId(base64Audio, 'audio/webm');
            if (transcribedId) setEmpIdInput(transcribedId);
            else alert("Employee not found");
          } catch (error) {
            alert("Voice transcription failed.");
          } finally {
            setIsProcessingAudio(false);
          }
        };
        stream.getTracks().forEach(track => track.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err: any) {
      alert("Error accessing microphone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      mediaRecorderRef.current = null;
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const startCamera = async () => {
    try {
      setShowCamera(true);
      setUploadedImage(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
      setHasFlash(!!capabilities.torch);
      setIsFlashOn(false);
    } catch (err: any) {
      console.error("Camera Error:", err);
      setShowCamera(false);
      alert("Could not access camera.");
    }
  };

  const closeCamera = () => {
    stopCameraStream();
    setShowCamera(false);
    setIsProcessingImage(false);
    setDetectedId(null);
    setIsConfirming(false);
    setUploadedImage(null);
  };

  const toggleFlash = async () => {
    if (streamRef.current) {
      const track = streamRef.current.getVideoTracks()[0];
      if (track) {
        try {
          await track.applyConstraints({ advanced: [{ torch: !isFlashOn } as any] });
          setIsFlashOn(!isFlashOn);
        } catch (error) { console.error(error); }
      }
    }
  };

  const captureAndScan = useCallback(async (isAutoMode = false) => {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
      setIsProcessingImage(true);
      if (!isAutoMode) video.pause();

      try {
        const id = await extractIdFromImage(base64Image, 'image/jpeg');
        if (id) {
          if (isAutoMode) {
            setDetectedId(id);
            setIsConfirming(true);
            playAlertSound('success');
          } else {
            setEmpIdInput(id);
            playAlertSound('success'); 
            closeCamera();
          }
        } else {
          if (!isAutoMode) {
             // Keep trying silently in auto mode
             video.play(); 
          } else {
             alert("Employee not found");
             video.play();
          }
        }
      } catch (error) {
        if (!isAutoMode) { alert("Employee not found"); video.play(); }
      } finally {
        if (streamRef.current) setIsProcessingImage(false);
      }
    }
  }, []);

  useEffect(() => {
    if (showCamera && streamRef.current && !uploadedImage) {
      autoScanIntervalRef.current = window.setInterval(() => {
        if (!isProcessingRef.current && !isConfirmingRef.current) {
          captureAndScan(true);
        }
      }, 2000);
    }
    return () => {
      if (autoScanIntervalRef.current) clearInterval(autoScanIntervalRef.current);
    };
  }, [showCamera, captureAndScan, uploadedImage]);

  const handleConfirmScan = () => {
    if (detectedId) {
      setEmpIdInput(detectedId);
      closeCamera();
    }
  };

  const handleRetryScan = () => {
    setDetectedId(null);
    setIsConfirming(false);
    setUploadedImage(null);
  };

  const triggerFileUpload = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const result = reader.result as string;
      setUploadedImage(result);
      const base64Image = result.split(',')[1];
      try {
        const id = await extractIdFromImage(base64Image, file.type);
        if (id) {
           setDetectedId(id);
           setIsConfirming(true);
           playAlertSound('success');
        } else {
           alert("Employee not found");
           setUploadedImage(null);
        }
      } catch (error) {
        alert("Employee not found");
        setUploadedImage(null);
      } finally {
        setIsProcessingImage(false);
      }
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen flex flex-col items-center pb-10 bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <header className="w-full bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 relative overflow-hidden z-10 transition-colors duration-300">
        <div className="absolute top-0 right-0 hidden md:block">
          <div className="w-16 h-16 bg-gray-600 dark:bg-gray-700 transform rotate-45 translate-x-8 -translate-y-8 transition-colors"></div>
          <div className="absolute top-2 right-2 text-white"><i className="fas fa-ribbon"></i></div>
        </div>
        <button onClick={toggleDarkMode} className="absolute top-4 right-4 md:right-auto md:left-4 text-gray-500 dark:text-gray-300 hover:text-teal-500 dark:hover:text-teal-400 transition-colors p-2">
          <i className={`fas ${settings.darkMode ? 'fa-sun' : 'fa-moon'} text-xl`}></i>
        </button>
        <div className="py-6 px-4 text-center">
          <h1 className="text-xl md:text-2xl font-black text-gray-700 dark:text-gray-100 tracking-wide uppercase transition-colors">{APP_TITLE}</h1>
        </div>
      </header>

      <main className="w-full max-w-2xl px-4 mt-8">
        {view === ViewState.DASHBOARD && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <label className="block text-center text-xl font-black text-gray-800 dark:text-gray-200 mb-2 uppercase tracking-wide transition-colors">Employee No.</label>
              <div className="flex gap-2 mb-4">
                  <div className="relative flex-1">
                      <input type="text" value={empIdInput} onChange={(e) => setEmpIdInput(e.target.value.toUpperCase())} disabled={isProcessingAudio || isProcessingImage} className="w-full text-center text-2xl font-bold py-3 pl-4 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg shadow-inner text-gray-800 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200 dark:focus:ring-teal-900 transition-all duration-300 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:text-gray-400" placeholder={isProcessingAudio ? "Listening..." : (isProcessingImage ? "Scanning..." : INPUT_PLACEHOLDER)} />
                      <button onClick={toggleRecording} disabled={isProcessingAudio || isProcessingImage} className={`absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-all duration-200 focus:outline-none ${isRecording ? "bg-red-500 text-white animate-pulse" : "text-gray-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-gray-700"}`} title="Voice Input"><i className={`fas ${isRecording ? 'fa-stop' : 'fa-microphone'} text-lg`}></i></button>
                  </div>
                  <button onClick={startCamera} disabled={isProcessingAudio || isProcessingImage} className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg px-4 shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50" title="Scan QR/Barcode"><i className="fas fa-camera text-xl"></i></button>
              </div>
              {(isProcessingAudio || isProcessingImage) && <p className="text-center text-teal-600 dark:text-teal-400 text-sm mt-2 animate-pulse">{isProcessingAudio ? "Transcribing audio..." : "Analyzing image..."}</p>}
            </div>

            <div className="flex justify-center gap-4 mb-8">
               <button onClick={() => handleCheckAttendance(false)} disabled={loading || isRecording || isProcessingAudio || isProcessingImage} className="bg-teal-400 hover:bg-teal-500 text-white text-xl font-bold py-3 px-10 rounded shadow-md transform active:scale-95 transition-all duration-200 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg">{loading ? <i className="fas fa-spinner fa-spin"></i> : "GO"}</button>
              <button onClick={() => setView(ViewState.SETTINGS)} disabled={isRecording} className="bg-gray-600 hover:bg-gray-700 dark:bg-gray-700 dark:hover:bg-gray-600 text-white text-xl font-bold py-3 px-6 rounded shadow-md transform active:scale-95 transition-all duration-200 hover:shadow-lg disabled:opacity-50" title="Settings"><i className="fas fa-cog"></i></button>
            </div>

            <AttendanceTable records={records} />

            <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm animate-fade-in delay-300 transition-colors">
              <p>Auto-check active at: {settings.checkTimes.join(', ')}</p>
              {settings.enableSound && <p><i className="fas fa-volume-up"></i> Sound On</p>}
            </div>
          </div>
        )}

        {view === ViewState.SETTINGS && <Settings settings={settings} onSave={handleSettingsSave} onBack={() => setView(ViewState.DASHBOARD)} />}

        {showCamera && (
          <div className="fixed inset-0 z-50 bg-black bg-opacity-100 flex flex-col animate-fade-in">
            <div className="absolute top-0 left-0 w-full p-4 z-20 bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
              <div className="flex justify-center w-full pointer-events-auto">
                {isConfirming && detectedId ? (
                  <div className="inline-block bg-white/90 backdrop-blur text-black px-6 py-2 rounded-full shadow-lg animate-slide-up">
                    <span className="text-xs font-bold text-gray-500 block uppercase">Detected ID</span>
                    <span className="text-xl font-black tracking-widest">{detectedId}</span>
                  </div>
                ) : (
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isProcessingImage ? "bg-teal-500 text-white animate-pulse" : "bg-black/40 text-gray-300"}`}>{isProcessingImage ? "Analyzing..." : "Auto-Scanning Active"}</span>
                )}
              </div>
              {hasFlash && !uploadedImage && (
                <button onClick={toggleFlash} className={`absolute top-4 right-4 pointer-events-auto p-3 rounded-full backdrop-blur-md transition-all duration-300 ${isFlashOn ? 'bg-yellow-500/20 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.4)] border border-yellow-400/30' : 'bg-gray-900/40 text-gray-300 hover:bg-gray-800/60 border border-white/10'}`}><i className="fas fa-bolt text-lg"></i></button>
              )}
            </div>
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-black">
              {uploadedImage ? <img src={uploadedImage} alt="Scan Upload" className="w-full h-full object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover"></video>}
              <canvas ref={canvasRef} className="hidden"></canvas>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
              {!isConfirming && !uploadedImage && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-72 h-48 border-0">
                    <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-teal-400 rounded-tl-lg shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                    <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-teal-400 rounded-tr-lg shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                    <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-teal-400 rounded-bl-lg shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                    <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-teal-400 rounded-br-lg shadow-[0_0_10px_rgba(45,212,191,0.5)]"></div>
                    <div className="absolute top-0 left-0 w-full h-1 bg-red-500 opacity-80 shadow-[0_0_15px_#ef4444] animate-[scan_2s_ease-in-out_infinite]"></div>
                  </div>
                   <p className="absolute mt-64 text-white/70 font-mono text-sm bg-black/40 px-3 py-1 rounded">Align code within frame</p>
                </div>
              )}
            </div>
            <div className="h-32 bg-black flex items-center justify-center gap-16 px-6 relative z-30">
              {isConfirming ? (
                 <>
                  <button onClick={handleRetryScan} className="w-16 h-16 rounded-full bg-gray-800 text-white flex items-center justify-center hover:bg-gray-700 active:scale-95 transition-all shadow-lg border border-gray-600" title="Retake"><i className="fas fa-times text-2xl"></i></button>
                  <button onClick={handleConfirmScan} className="w-20 h-20 rounded-full bg-teal-500 text-white flex items-center justify-center hover:bg-teal-400 active:scale-95 transition-all shadow-[0_0_20px_rgba(20,184,166,0.5)] border-4 border-black" title="Confirm Use"><i className="fas fa-check text-3xl"></i></button>
                 </>
              ) : (
                 <>
                  <button onClick={closeCamera} className="absolute left-8 text-white/80 hover:text-white p-4"><span className="text-sm font-bold">Cancel</span></button>
                  <div className="flex items-center gap-8">
                    {!uploadedImage && (
                      <button onClick={() => captureAndScan(false)} disabled={isProcessingImage} className="relative group" title="Manual Capture">
                        <div className="w-20 h-20 rounded-full border-[6px] border-white flex items-center justify-center transition-transform transform group-active:scale-95">
                            <div className={`w-16 h-16 rounded-full ${isProcessingImage ? 'bg-gray-500' : 'bg-white'} flex items-center justify-center shadow-lg`}>{isProcessingImage && <i className="fas fa-spinner fa-spin text-gray-800 text-2xl"></i>}</div>
                        </div>
                      </button>
                    )}
                    <button onClick={triggerFileUpload} className={`w-12 h-12 rounded-full bg-gray-800 text-white border border-gray-600 flex items-center justify-center hover:bg-gray-700 active:scale-95 transition-all ${uploadedImage ? '' : 'absolute right-8 md:static'}`} title="Upload Image"><i className="fas fa-image text-xl"></i></button>
                  </div>
                 </>
              )}
            </div>
            <style>{`@keyframes scan { 0% { top: 5%; opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { top: 95%; opacity: 0; } }`}</style>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;