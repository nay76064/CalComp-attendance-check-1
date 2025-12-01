
import React, { useState, useRef } from 'react';
import { UserSettings } from '../types';
import { playAlertSound } from '../services/notificationService';
import { INPUT_PLACEHOLDER } from '../constants';

interface Props {
  settings: UserSettings;
  onSave: (newSettings: UserSettings) => void;
  onBack: () => void;
}

const DAYS_OF_WEEK = [
  { label: 'Sun', value: 0 },
  { label: 'Mon', value: 1 },
  { label: 'Tue', value: 2 },
  { label: 'Wed', value: 3 },
  { label: 'Thu', value: 4 },
  { label: 'Fri', value: 5 },
  { label: 'Sat', value: 6 },
];

const Settings: React.FC<Props> = ({ settings, onSave, onBack }) => {
  const [empId, setEmpId] = useState(settings.empId);
  const [checkTimes, setCheckTimes] = useState<string[]>(settings.checkTimes);
  const [checkDays, setCheckDays] = useState<number[]>(settings.checkDays);
  const [soundEnabled, setSoundEnabled] = useState(settings.enableSound);
  const [customSound, setCustomSound] = useState<string | null>(settings.customSound);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddTime = () => {
    setCheckTimes([...checkTimes, "08:00"]);
  };

  const handleTimeChange = (index: number, val: string) => {
    const newTimes = [...checkTimes];
    newTimes[index] = val;
    setCheckTimes(newTimes);
  };

  const handleRemoveTime = (index: number) => {
    const newTimes = checkTimes.filter((_, i) => i !== index);
    setCheckTimes(newTimes);
  };

  const toggleDay = (dayValue: number) => {
    if (checkDays.includes(dayValue)) {
      setCheckDays(checkDays.filter(d => d !== dayValue));
    } else {
      setCheckDays([...checkDays, dayValue].sort());
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) { // Limit to 2MB
        alert("File is too large. Please upload an audio file smaller than 2MB.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setCustomSound(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveSound = () => {
    setCustomSound(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleTestSound = () => {
    playAlertSound('success', customSound);
  };

  const handleSave = () => {
    onSave({
      ...settings,
      empId,
      checkTimes,
      checkDays,
      enableSound: soundEnabled,
      customSound: customSound
    });
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md max-w-md mx-auto mt-4 max-h-[80vh] overflow-y-auto animate-scale-in transition-colors duration-300">
      <h2 className="text-xl font-bold text-teal-700 dark:text-teal-400 mb-4 flex items-center gap-2">
        <i className="fas fa-cog"></i> Settings
      </h2>

      <div className="mb-4">
        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
          Employee ID (Auto-save)
        </label>
        <input
          type="text"
          value={empId}
          onChange={(e) => setEmpId(e.target.value.toUpperCase())}
          className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-teal-500 transition-colors duration-300"
          placeholder={INPUT_PLACEHOLDER}
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
          Auto-Check Days
        </label>
        <div className="flex justify-between gap-1">
          {DAYS_OF_WEEK.map((day) => (
            <button
              key={day.value}
              onClick={() => toggleDay(day.value)}
              className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center transition-colors duration-200 ${
                checkDays.includes(day.value)
                  ? 'bg-teal-500 text-white shadow-md'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
          Auto-Check Times
        </label>
        <div className="space-y-2">
          {checkTimes.map((time, index) => (
            <div key={index} className="flex gap-2">
              <input
                type="time"
                value={time}
                onChange={(e) => handleTimeChange(index, e.target.value)}
                className="shadow appearance-none border dark:border-gray-600 rounded w-full py-2 px-3 text-gray-700 dark:text-white dark:bg-gray-700 leading-tight focus:outline-none focus:shadow-outline focus:border-teal-500 transition-colors duration-300"
              />
              <button
                onClick={() => handleRemoveTime(index)}
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-3 rounded focus:outline-none focus:shadow-outline"
              >
                <i className="fas fa-trash"></i>
              </button>
            </div>
          ))}
          <button
            onClick={handleAddTime}
            className="text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 font-bold py-1 px-2 text-sm flex items-center gap-1"
          >
            <i className="fas fa-plus"></i> Add Time
          </button>
        </div>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold">
            Sound Notification
          </label>
          <button
             onClick={() => setSoundEnabled(!soundEnabled)}
             className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${soundEnabled ? 'bg-teal-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
             <div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform duration-300 ${soundEnabled ? 'translate-x-6' : 'translate-x-0'}`}></div>
          </button>
        </div>
        
        {soundEnabled && (
          <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg animate-fade-in transition-colors duration-300">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Default: Beep Sound. Upload a short MP3/WAV for custom alert.
            </p>
            <div className="flex flex-col gap-2">
              <input 
                type="file" 
                accept="audio/*" 
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="text-xs text-gray-600 dark:text-gray-300" 
              />
              
              <div className="flex gap-2 mt-1">
                <button 
                  onClick={handleTestSound}
                  className="bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 hover:bg-teal-200 dark:hover:bg-teal-800 text-xs font-bold py-1 px-3 rounded"
                >
                  <i className="fas fa-play"></i> Test
                </button>
                {customSound && (
                  <button 
                    onClick={handleRemoveSound}
                    className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 text-xs font-bold py-1 px-3 rounded"
                  >
                    Reset
                  </button>
                )}
              </div>
              {customSound && <span className="text-xs text-green-600 dark:text-green-400 mt-1"><i className="fas fa-check-circle"></i> Custom sound loaded</span>}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700 mt-6">
        <button
          onClick={onBack}
          className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="bg-teal-500 hover:bg-teal-700 text-white font-bold py-2 px-6 rounded focus:outline-none focus:shadow-outline shadow-md transform active:scale-95 transition-all"
        >
          Save
        </button>
      </div>
    </div>
  );
};

export default Settings;
