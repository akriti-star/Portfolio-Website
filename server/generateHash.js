import bcrypt from 'bcryptjs';

const password = "akriti2509";
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
  if (err) {
    console.error('Error generating hash:', err);
    return;
  }
  console.log('Hashed password:', hash);
});