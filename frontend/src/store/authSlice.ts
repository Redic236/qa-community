import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '@/types/models';
import { tokenStorage, userStorage } from '@/utils/storage';

export interface AuthState {
  token: string | null;
  user: User | null;
}

const initialState: AuthState = {
  token: tokenStorage.get(),
  user: userStorage.get(),
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ token: string; user: User }>) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      tokenStorage.set(action.payload.token);
      userStorage.set(action.payload.user);
    },
    updateUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
      userStorage.set(action.payload);
    },
    logout(state) {
      state.token = null;
      state.user = null;
      tokenStorage.clear();
      userStorage.clear();
    },
  },
});

export const { setCredentials, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
