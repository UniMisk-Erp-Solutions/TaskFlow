import React, { useEffect, useState } from 'react';
import api from '../api';

export default function EmployeeSelect({ value, onChange, style }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('EmployeeSelect - Fetching employees...');
    api.get('/auth/profiles')
      .then(({ data }) => {
        console.log('EmployeeSelect - Raw profiles data:', data);
        
        // Filter only employees and show only names
        const employeeList = data?.filter(p => p.role === 'employee') || [];
        console.log('EmployeeSelect - Filtered employees:', employeeList);
        
        setEmployees(employeeList);
        setLoading(false);
      })
      .catch(err => {
        console.error('EmployeeSelect - Failed to fetch employees:', err);
        console.error('EmployeeSelect - Error details:', err.response?.data);
        setEmployees([]);
        setLoading(false);
      });
  }, []);

  return (
    <select 
      className="select" 
      value={value} 
      onChange={(e) => onChange(e.target.value)} 
      style={{
        ...style,
        maxHeight: '200px',
        overflowY: 'auto',
        fontSize: '14px',
        padding: '8px 12px',
        minHeight: '40px'
      }}
    >
      <option value="">— Select employee —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id} style={{ padding: '8px 12px', fontSize: '14px' }}>
          {e.full_name || e.email}
        </option>
      ))}
    </select>
  );
}
