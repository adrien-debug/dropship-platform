import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').max(255),
  password: z.string().min(1, 'Mot de passe requis').max(128),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Nom requis').max(200),
    email: z.string().trim().email('Adresse e-mail invalide').max(255),
    password: z.string().min(8, 'Au moins 8 caractères').max(128),
    confirmPassword: z.string().min(1, 'Confirmation requise').max(128),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Les mots de passe ne correspondent pas',
    path: ['confirmPassword'],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Adresse e-mail invalide').max(255),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
