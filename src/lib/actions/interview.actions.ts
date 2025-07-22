import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, serverTimestamp, doc, getDoc, updateDoc, Timestamp, setDoc, deleteDoc, addDoc, DocumentData, FirestoreDataConverter, QueryDocumentSnapshot, SnapshotOptions } from 'firebase/firestore';
import { Interview } from '@/types';

const interviewsCollection = collection(db, 'interviews');

export const createInterview = async (
  userId: string,
  role: string,
  level: string,
  topic: string,
  focus: string,
  time: number,
  questions: string[]
): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, "interviews"), {
      userId,
      role,
      level,
      topic,
      focus,
      time,
      questions,
      createdAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    console.error("Error creating interview:", error);
    throw new Error("Failed to create interview.");
  }
};

export const getInterviewsByUser = async (userId: string): Promise<Interview[]> => {
  try {
    const q = query(interviewsCollection, where("userId", "==", userId));
    const querySnapshot = await getDocs(q);
    const interviews: Interview[] = [];
    querySnapshot.forEach((doc) => {
      interviews.push({ id: doc.id, ...doc.data() } as Interview);
    });
    return interviews;
  } catch (error) {
    console.error("Error fetching interviews:", error);
    throw new Error("Failed to fetch interviews.");
  }
};

export const getInterviewById = async (interviewId: string): Promise<Interview | null> => {
  try {
    const interviewDocRef = doc(db, "interviews", interviewId);
    const interviewDoc = await getDoc(interviewDocRef);
    if (interviewDoc.exists()) {
      return { id: interviewDoc.id, ...interviewDoc.data() } as Interview;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error fetching interview by ID:", error);
    throw new Error("Failed to fetch interview.");
  }
};

export const updateInterviewFeedback = async (interviewId: string, feedback: string): Promise<void> => {
  try {
    const interviewRef = doc(db, 'interviews', interviewId);
    await updateDoc(interviewRef, {
      feedback: feedback,
    });
    console.log('Interview feedback updated successfully!');
  } catch (error) {
    console.error('Error updating interview feedback: ', error);
    throw new Error('Failed to update interview feedback.');
  }
};

export const updateInterviewTranscript = async (interviewId: string, transcript: { role: 'assistant' | 'user'; content: string }[]) => {
  try {
    const interviewDocRef = doc(db, "interviews", interviewId);
    await updateDoc(interviewDocRef, {
      transcript: transcript
    });
  } catch (error) {
    console.error("Error updating transcript:", error);
    throw new Error("Failed to update transcript.");
  }
};

export const generateFeedback = async (interviewId: string, transcript: { role: 'assistant' | 'user'; content: string }[]): Promise<string> => {
  if (!transcript || transcript.length === 0) {
    throw new Error("Transcript is empty, cannot generate feedback.");
  }

  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ transcript }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to fetch feedback from API.');
    }

    const { feedback } = await response.json();

    const interviewRef = doc(db, 'interviews', interviewId);
    await updateDoc(interviewRef, { feedback });

    return feedback;
  } catch (error) {
    console.error('Error generating feedback:', error);
    throw error;
  }
};

import { auth } from "../firebase";

// Fetch a single interview by its ID
export const getInterview = async (interviewId: string): Promise<Interview | null> => {
  try {
    const docRef = doc(db, 'interviews', interviewId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Interview;
    } else {
      console.log('No such document!');
      return null;
    }
  } catch (error) {
    console.error('Error getting interview:', error);
    throw new Error('Failed to get interview.');
  }
};

export const deleteInterview = async (interviewId: string): Promise<void> => {
  try {
    const currentUser = auth.currentUser;
    console.log("Attempting to delete interview. User UID:", currentUser?.uid);

    if (!currentUser) {
      throw new Error("User not authenticated.");
    }

    const interviewDocRef = doc(db, "interviews", interviewId);
    await deleteDoc(interviewDocRef);
  } catch (error) {
    console.error("Error deleting interview:", error);
    throw new Error("Failed to delete interview.");
  }
};
