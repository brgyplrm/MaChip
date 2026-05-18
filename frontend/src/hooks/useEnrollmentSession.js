import { useState, useCallback } from 'react';
import { fetchWithAuth } from '../utils/api';

const useEnrollmentSession = () => {
  const [enrollmentState, setEnrollmentState] = useState({
    isActive: false,
    userId: null,
    enrollmentType: null,  // 'RFID' | 'FP'
    slotId: 0,
    isLoading: false,
    error: null
  });

  const initiateEnrollment = useCallback(async (userId, enrollmentType, slotId = 0) => {
    try {
      setEnrollmentState(prev => ({ ...prev, isLoading: true, error: null }));

      if (enrollmentState.isActive && enrollmentState.enrollmentType !== enrollmentType) {
        console.log(`[ENROLL] Switching from ${enrollmentState.enrollmentType} to ${enrollmentType}`);
        await clearEnrollment();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const response = await fetchWithAuth('/api/esp/fingerprint/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          enrollmentType,
          type: enrollmentType,
          slotId
        })
      });

      const data = await response.json();

      if (response.ok && data.active) {
        setEnrollmentState({
          isActive: true,
          userId,
          enrollmentType,
          slotId: data.slotId || 0,
          isLoading: false,
          error: null
        });

        console.log(`[ENROLL] Session initiated: ${enrollmentType} for user ${userId}`);
        return { success: true, data };
      } else {
        throw new Error(data.error || 'Enrollment session failed to become active');
      }
    } catch (err) {
      console.error(`[ENROLL ERROR]`, err);
      setEnrollmentState(prev => ({
        ...prev,
        isLoading: false,
        error: err.message
      }));
      return { success: false, error: err.message };
    }
  }, [enrollmentState.isActive, enrollmentState.enrollmentType]);

  const clearEnrollment = useCallback(async () => {
    try {
      if (!enrollmentState.isActive) return { success: true };

      const response = await fetchWithAuth('/api/esp/fingerprint/session/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: enrollmentState.userId })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setEnrollmentState({
          isActive: false,
          userId: null,
          enrollmentType: null,
          slotId: 0,
          isLoading: false,
          error: null
        });

        console.log(`[ENROLL] Session cleared`);
        return { success: true };
      } else {
        throw new Error(data.error || 'Failed to clear enrollment session');
      }
    } catch (err) {
      console.error(`[CLEAR ERROR]`, err);
      setEnrollmentState({
        isActive: false,
        userId: null,
        enrollmentType: null,
        slotId: 0,
        isLoading: false,
        error: null
      });
      return { success: false, error: err.message };
    }
  }, [enrollmentState.isActive, enrollmentState.userId]);

  const getSessionStatus = useCallback(async () => {
    try {
      const response = await fetchWithAuth('/api/esp/fingerprint/session/status');
      if (response.ok) {
        return await response.json();
      }
      throw new Error('Failed to get session status');
    } catch (err) {
      console.error(`[STATUS ERROR]`, err);
      return { success: false, error: err.message };
    }
  }, []);

  return {
    enrollmentState,
    initiateEnrollment,
    clearEnrollment,
    getSessionStatus
  };
};

export default useEnrollmentSession;
