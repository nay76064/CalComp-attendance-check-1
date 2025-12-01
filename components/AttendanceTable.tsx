
import React from 'react';
import { AttendanceRecord } from '../types';

interface Props {
  records: AttendanceRecord[];
}

const AttendanceTable: React.FC<Props> = ({ records }) => {
  return (
    <div className="w-full overflow-hidden rounded-lg shadow-sm border border-teal-200 dark:border-teal-800 animate-fade-in transition-colors duration-300">
      <div className="grid grid-cols-4 bg-teal-500 dark:bg-teal-800 text-white font-bold text-center text-sm md:text-base transition-colors">
        <div className="p-3 border-r border-teal-400 dark:border-teal-700 flex items-center justify-center">NO.</div>
        <div className="p-3 border-r border-teal-400 dark:border-teal-700 flex items-center justify-center">EMP NO.</div>
        <div className="p-3 border-r border-teal-400 dark:border-teal-700 flex items-center justify-center">NAME</div>
        <div className="p-3 flex items-center justify-center">DATE TIME</div>
      </div>
      
      <div className="flex flex-col">
        {records.length === 0 ? (
           <div className="p-6 text-center text-gray-500 dark:text-gray-400 italic bg-white dark:bg-gray-800 animate-slide-up transition-colors">
             No records found for this Employee ID.
           </div>
        ) : (
          records.map((record, index) => (
            <div 
              key={record.id} 
              className={`grid grid-cols-4 text-center text-sm md:text-lg border-b border-teal-100 dark:border-teal-900 animate-slide-up transition-colors duration-300 ${
                index % 2 === 0 ? 'bg-teal-100 dark:bg-gray-700' : 'bg-teal-50 dark:bg-gray-800'
              }`}
              style={{ animationDelay: `${index * 50}ms`, opacity: 0 }} // opacity 0 start handled by keyframe from, but ensuring for delay
            >
              <div className="p-4 flex items-center justify-center font-semibold text-gray-700 dark:text-gray-200">
                {index + 1}
              </div>
              <div className="p-4 flex items-center justify-center font-bold text-gray-800 dark:text-white">
                {record.empNo}
              </div>
              <div className="p-4 flex flex-col items-center justify-center font-bold text-gray-800 dark:text-white leading-tight">
                {record.name.split(' ').map((n, i) => <span key={i}>{n}</span>)}
              </div>
              <div className="p-4 flex flex-col items-center justify-center font-bold text-gray-800 dark:text-white">
                <span>{record.dateTime.split(' ')[0]}</span>
                <span>{record.dateTime.split(' ')[1]}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AttendanceTable;
