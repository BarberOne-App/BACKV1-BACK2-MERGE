import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const email = 'superadm@barberone.com';
    const password = '123456';
    const name = 'Super Admin';

    // Gerar hash bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Verificar se o email já existe
    const existingUser = await prisma.users.findUnique({
      where: { email },
    });

    if (existingUser) {
      console.log(`✓ Usuário com email ${email} já existe. Atualizando...`);
      const updated = await prisma.users.update({
        where: { email },
        data: {
          role: 'super_admin',
          is_admin: true,
          password_hash: passwordHash,
          current_barbershop_id: null,
          updated_at: new Date(),
        },
      });
      console.log('✓ Usuário super_admin atualizado:', updated.email);
    } else {
      console.log(`✓ Criando novo super_admin com email ${email}...`);
      const created = await prisma.users.create({
        data: {
          name,
          email,
          phone: null,
          role: 'super_admin',
          is_admin: true,
          password_hash: passwordHash,
          current_barbershop_id: null,
        },
      });
      console.log('✓ Super admin criado com sucesso:', created.email);
    }
  } catch (error) {
    console.error('✗ Erro ao criar super_admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
