const express = require('express');
const app = express();
const multer = require('multer'); // Importar multer
const request = require('request'); // Agregado para manejar las solicitudes HTTP
const btSerial = new (require('bluetooth-serial-port')).BluetoothSerialPort();
const socketIo = require('socket.io');
const http = require('http');
const server = http.createServer(app); // Crea un servidor HTTP
const io = require('socket.io')(server); //Pasa el servidor HTTP a Socket.IO
const bodyParser = require('body-parser');
const cors = require('cors');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs'); 
const  router = express.Router();


/////////////////////////bluetooth/////////////////////////////////
//const address = '00:23:05:00:3E:7D';

//let idTarjetaBluetooth = '';

//btSerial.findSerialPortChannel(address, function(channel) {
//    btSerial.connect(address, channel, function() {
//        console.log('Conectado al dispositivo Bluetooth');
//        btSerial.on('data', function(buffer) {
//            try {
//                const data = buffer.toString('utf-8');
//                console.log('Datos recibidos:', data);
//                idTarjetaBluetooth = data;
        
//                // Emitir el nuevo valor a los clientes conectados a través de WebSocket
//                io.emit('idTarjetaBluetooth', idTarjetaBluetooth);
        
//                // Emitir el evento para actualizar la página
//                io.emit('updatePage');
//            } catch (error) {
//                console.error('Error al procesar datos:', error);
//            }
//        });

//    }, function() {
//        console.error('Error al conectar al dispositivo Bluetooth');
//    });

//    btSerial.on('failure', function(err) {
//        console.error('Error al encontrar el canal del puerto serial:', err);
//    });
//});


//// Establecer conexión WebSocket para actualizar en tiempo real
//io.on('connection', (socket) => {
//    console.log('Cliente conectado');

//    // Enviar el valor actual al cliente recién conectado
//    socket.emit('idTarjetaBluetooth', idTarjetaBluetooth);

//    socket.on('disconnect', () => {
//        console.log('Cliente desconectado');
//    });
//});
//btSerial.on('data', async function(buffer) {
//    try {
//        const data = buffer.toString('utf-8').trim();
//        console.log('Datos recibidos:', data);

//        // Comparar con la base de datos y obtener la información del alumno
//        if (data) {
//            connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [data], async (error, results) => {
//                if (error) {
//                    console.error('Error al buscar en la base de datos:', error);
//                } else {
//                    const alumnoData = results.length > 0 ? results[0] : null;

//                    // Emitir el nuevo valor y la información del alumno a los clientes conectados
//                    io.emit('idTarjetaBluetooth', data);
//                    io.emit('alumnoData', alumnoData);
//                }
//            });
//        }

//        // Emitir el evento para actualizar la página
//        io.emit('updatePage');
//    } catch (error) {
//        console.error('Error al procesar datos:', error);
//    }
//});

///////////////////////fin de bluetooth////////////////////


// seteamos urlencoded para capturar los ddatos del formulario
app.use(express.urlencoded({extended:false}));
app.use(express.json());

// invocar a dotenv(ubicacion de los datos de la base de datos)
const dotenv = require('dotenv');
dotenv.config({path:'./env/.env'});

// el directorio public
app.use('/public', express.static('public'));
app.use('/public', express.static(__dirname + '/public'));

//establecemos el motor de plantillas
app.set('view engine', 'ejs');

//invocamos a bcryptjs
const bcrypt = require('bcryptjs');

//var. de session
const session = require('express-session');
app.use(session({
    secret:'secret',
    resave: 'true',
    saveUninitialized:true,
    cookie: { maxAge: null }
}));
//invocar la conexion
const connection = require('./database/db')


/////////////rutas//////////////////////////////
app.get('/inicio', (req,res)=>{
    res.render('inicio');
})

app.get('/nosotros', (req,res)=>{
    res.render('nosotros');
})

app.get('/api', (req,res)=>{
    res.render('api');
})

app.get('/redessociales', (req,res)=>{
    res.render('redessociales');
})

app.get('/admin', (req,res)=>{
     res.render('admin');
 })

 app.get('/fotos', (req,res)=>{
    res.render('fotos');
 })
app.get('/miperfil', (req, res) => {
    connection.query('SELECT nombre FROM carrera', (error, carreras) => {
        if (error) {
            console.error('Error en la consulta de carreras:', error);
            res.status(500).send('Error en el servidor');
        } else {
            const nombresCarreras = carreras.map(carrera => carrera.nombre);

            res.render('miperfil', {
                nombresCarreras: JSON.stringify(nombresCarreras)
            });
        }
    });
});

//////////////Fin de rutas//////////////////


////////registro con verificación de reCAPTCHA//////////////////////////////////
// Configuraracion multer para guardar las imágenes en la carpeta public/imgs
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/img/admin');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });


const recaptchaSecretKey = '6LfLepIpAAAAAGYRnUxL2HKehFzMmEjMfrg7y-Bn';
app.post('/inicio', upload.single('foto'), async (req, res) => {
    const nombre = req.body.nombre;
    const lastname = req.body.lastname;
    const correo = req.body.correo;
    const claveempleado = req.body.claveempleado;
    const password = req.body.password;

    const foto = req.file ? req.file.filename : null;
    const recaptchaResponse = req.body['g-recaptcha-response'];

    // Verificar reCAPTCHA
    const recaptchaVerifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${recaptchaSecretKey}&response=${recaptchaResponse}`;

    request(recaptchaVerifyUrl, async (err, response, body) => {
        try {
            body = JSON.parse(body);

            if (body.success !== undefined && !body.success) {
                return res.render('inicio', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡Verificación reCAPTCHA fallida!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }

            // Verificar si ya existe un usuario con el mismo correo
            const results = await connection.query('SELECT * FROM administrador WHERE correo = ?', [correo]);

            if (results.length > 0) {
                // Ya existe un usuario con el mismo correo
                return res.render('inicio', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡El correo ya está registrado!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }

            // No existe un usuario con el mismo correo, proceder con el registro
            const passwordHash = await bcrypt.hash(password, 8);

            await connection.query('INSERT INTO administrador SET ?', {
                nombre: nombre,
                lastname: lastname,
                correo: correo,
                claveempleado: claveempleado,
                foto: foto,
                password: passwordHash
            });

            return res.render('inicio', {
                alert: true,
                alertTitle: "Registro",
                alertMessage: "¡Registro exitoso!",
                alertIcon: 'success',
                showConfirmButton: false,
                timer: 1500,
                ruta: ''
            });

        } catch (error) {
            console.log(error);
            return res.render('inicio', {
                alert: true,
                alertTitle: "Error",
                alertMessage: "¡Ocurrió un error durante el registro!",
                alertIcon: 'error',
                showConfirmButton: false,
                timer: 1500,
                ruta: ''
            });
        }
    });
});
///////////////fin registro con verificación de reCAPTCHA///////////////////////////

//////////////////cambiar la contraseña admin////////////////////
app.post('/cambiar-contrasena', async (req, res) => {
    const correo = req.body.correo;
    const antiguaContrasena = req.body.antiguaContrasena;
    const nuevaContrasena = req.body.nuevaContrasena;

    // Verificar si el usuario con el correo dado existe
    connection.query('SELECT * FROM administrador WHERE correo = ?', [correo], async (error, results) => {
        if (error) {
            console.log(error);
        } else {
            if (results.length > 0) {
                // Usuario encontrado, verificar la antigua contraseña
                const usuario = results[0];
                const isPasswordValid = await bcrypt.compare(antiguaContrasena, usuario.password);

                if (isPasswordValid) {
                    // La antigua contraseña es válida, actualizar la contraseña
                    const nuevaContrasenaHash = await bcrypt.hash(nuevaContrasena, 8);

                    connection.query('UPDATE administrador SET password = ? WHERE correo = ?', [nuevaContrasenaHash, correo], async (error, results) => {
                        if (error) {
                            console.log(error);
                        } else {
                            res.render('cambiar-contrasena', {
                                alert: true,
                                alertTitle: "Cambio de Contraseña",
                                alertMessage: "¡Contraseña cambiada con éxito!",
                                alertIcon: 'success',
                                showConfirmButton: false,
                                timer: 1500,
                                ruta: ''
                            });
                        }
                    });
                } else {
                    // La antigua contraseña no es válida
                    res.render('cambiar-contrasena', {
                        alert: true,
                        alertTitle: "Error",
                        alertMessage: "¡La antigua contraseña es incorrecta!",
                        alertIcon: 'error',
                        showConfirmButton: false,
                        timer: 1500,
                        ruta: ''
                    });
                }
            } else {
                // No se encontró ningún usuario con el correo dado
                res.render('cambiar-contrasena', {
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "¡Usuario no encontrado!",
                    alertIcon: 'error',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''
                });
            }
        }
    });
});
/////////////////fin cambiar la contraseña admin///////////////////////

//////////////////autenticacion para el inicio de sesion//////////////////
app.post('/auth', async (req, res)=> {
	const correo = req.body.correo;
    const password = req.body.password;
    let passwordHash = await bcrypt.hash(password, 8);
    if(correo && password){
        connection.query('SELECT * FROM administrador WHERE correo = ?', [correo], async (error, results)=> {
            if(results.length == 0 || !(await bcrypt.compare(password, results[0].password))){
                res.render('inicio',{
                    alert: true,
                    alertTitle: "Error",
                    alertMessage: "USUARIO y/o PASSWORD incorrectas",
                    alertIcon:'error',
                    showConfirmButton: true,
                    timer: false,
                    ruta: ''    
                })
            }else{
                req.session.loggedin = true;                
				req.session.nombre = results[0].nombre;
                req.session.foto = results[0].foto;
                req.session.lastname = results[0].lastname;
                req.session.correo = results[0].correo;
                req.session.claveempleado = results[0].claveempleado;
                
                res.render('inicio',{
                    alert: true,
                    alertTitle: "Conexion exitosa",
                    alertMessage: "Bienvenid@",
                    alertIcon:'success',
                    showConfirmButton: false,
                    timer: 1500,
                    ruta: ''    
                })
            }

        })
    }else{
        res.render('inicio',{
            alert: true,
            alertTitle: "Advertencia",
            alertMessage: "Por favor ingrese un usuario y una password",
            alertIcon:'warning',
            showConfirmButton: true,
            timer: false,
            ruta: ''    
        });
    }
});
//////////////////fin autenticacion para el inicio de sesion//////////////////
app.get('/entradasPorDiaYHora', (req, res) => {
    if (req.session.loggedin) {
        // Consulta para obtener el número de entradas por día y hora
        connection.query('SELECT DATE_FORMAT(horaentrada, "%Y-%m-%d") AS fecha, HOUR(horaentrada) AS hora, COUNT(*) AS cantidad FROM accesos GROUP BY fecha, hora;', (error, resultados) => {
            if (error) {
                console.error('Error en la consulta de entradas por día y hora:', error);
                res.status(500).json({ error: 'Error en el servidor' });
            } else {
                res.json(resultados);
            }
        });
    } else {
        res.status(403).json({ error: 'No autorizado' });
    }
});


//////////////////Rutas con Autenticacion///////////

app.get('/', (req, res) => {
    if (req.session.loggedin) {
        connection.query('SELECT carrera.id, carrera.nombre, COUNT(alumno.id) AS num_alumnos FROM carrera INNER JOIN alumno ON carrera.id = alumno.carrera GROUP BY carrera.id, carrera.nombre; ', (error, carreras) => {
            if (error) {
                console.error('Error en la consulta de carreras:', error);
                res.status(500).send('Error en el servidor');
            } else {
                res.render('index', {
                    login: true,
                    nombre: req.session.nombre,
                    lastname: req.session.lastname,
                    correo: req.session.correo,
                    claveempleado: req.session.claveempleado,
                    foto: `public/img/admin/${req.session.foto}`,
                    carreras: carreras  
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});


app.get('/entradas', async (req, res) => {
    if (req.session.loggedin) {
        // Verificar si la ID de tarjeta WiFi está presente
        if (!idTarjetaWiFi) {
            
            res.render('entradas', {
                login: true,
                nombre: req.session.nombre,
                idTarjetaWiFi: 'Sin datos',
                emitirDatosAlumno: null  // Enviar null para indicar que no hay datos de alumno
            });
            return;
        }

        try {
            // Realizar consulta a la base de datos para obtener los datos del alumno
            const results = await new Promise((resolve, reject) => {
                connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [idTarjetaWiFi], (error, results) => {
                    if (error) {
                        console.error('Error en la consulta de alumno:', error);
                        reject(error);
                    } else {
                        resolve(results);
                    }
                });
            });

            if (results.length === 0) {
                // No hay datos de alumno
                res.render('entradas', {
                    login: true,
                    nombre: req.session.nombre,
                    idTarjetaWiFi: idTarjetaWiFi,
                    emitirDatosAlumno: null
                });
            } else {
                // Renderizar la plantilla con los datos obtenidos
                const alumnoData = results[0];
                res.render('entradas', {
                    login: true,
                    nombre: req.session.nombre,
                    idTarjetaWiFi: idTarjetaWiFi,
                    emitirDatosAlumno: alumnoData
                });
            }
        } catch (error) {
            console.error('Error al procesar datos:', error);
            res.status(500).send('Error en el servidor');
        }
    } else {
        res.redirect('/inicio');
    }
});



app.get('/registrar', (req, res) => {
    if (req.session.loggedin) {
        // Realizar consulta a la base de datos para obtener la lista de carreras
        connection.query('SELECT * FROM carrera', (error, carreras) => {
            if (error) {
                console.error('Error en la consulta de carreras:', error);
                res.status(500).send('Error en el servidor');
            } else {
                // Renderizar la plantilla con los datos obtenidos
                res.render('registrar', {
                    login: true,
                    nombre: req.session.nombre,
                    idTarjetaWiFi: idTarjetaWiFi || '',
                    carreras: carreras  // Pasa los resultados de la consulta de carreras a la plantilla

                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});


app.get('/registros', (req, res) => {
    if (req.session.loggedin) {
        // Utiliza un JOIN para obtener la información de la carrera
        const query = 'SELECT alumno.*, carrera.nombre AS nombre_carrera FROM alumno LEFT JOIN carrera ON alumno.carrera = carrera.id';
        
        connection.query(query, (error, results) => {
            if (error) {
                console.log(error);
                res.send('Error al obtener los datos');
            } else {
                res.render('registros', {
                    login: true,
                    nombre: req.session.nombre,
                    alumnos: results
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});

app.get('/registros/alumnos/:id', (req, res) => {
    const alumnoId = req.params.id;
    const query = `SELECT alumno.*, carrera.nombre AS nombre_carrera, accesos.* FROM alumno LEFT JOIN carrera ON alumno.carrera = carrera.id INNER JOIN accesos ON alumno.idtarjeta = accesos.idtarjeta WHERE alumno.id = ${alumnoId}`;

    connection.query(query, (error, results) => {
        if (error) {
            console.log(error);
            res.send('Error al obtener los datos');
        } else {
            const workbook = new ExcelJS.Workbook();
            const worksheet = workbook.addWorksheet('Registros');

            worksheet.columns = [
                { header: 'Nombre', key: 'nombre', width: 15 },
                { header: 'Apellido', key: 'lastname', width: 15 },
                { header: 'Correo', key: 'correo', width: 30 },
                { header: 'Matricula', key: 'matricula', width: 15 },
                { header: 'ID tarjeta', key: 'idtarjeta', width: 20 },
                { header: 'Carrera', key: 'nombre_carrera', width: 40 },
                { header: 'Hora y fecha de acceso', key: 'horaentrada', width: 20 },
            ];

            results.forEach((alumno) => {
                
                const fechaHoraEntrada = `${alumno.horaentrada.toLocaleDateString()} ${alumno.horaentrada.toLocaleTimeString()}`;

                worksheet.addRow({
                    nombre: alumno.nombre,
                    lastname: alumno.lastname,
                    correo: alumno.correo,
                    matricula: alumno.matricula,
                    idtarjeta: alumno.idtarjeta || 'Sin datos',
                    nombre_carrera: alumno.nombre_carrera || 'Sin datos',
                    horaentrada: fechaHoraEntrada || 'Sin datos',
                });
            });

            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', 'attachment; filename=registros.xlsx');

            workbook.xlsx.write(res).then(() => {
                res.end();
            });
        }
    });
});


app.get('/cambiar-contrasena',(req, res)=>{
   if(req.session.loggedin){
          res.render('cambiar-contrasena',{
              login:true,
          })
      }else{
          res.redirect('/inicio');   
      }
  })



//////////fin autenticacion para las demas paginas cuando inicie sesion//////////////////
app.get('/api/alumnos/:imagen', (req, res) => {
    const imagen = req.params.imagen;
    const rutaImagen = path.join(__dirname, 'public', 'img', 'alumnos', imagen);


    if (fs.existsSync(rutaImagen)) {
        res.sendFile(rutaImagen);
    } else {
        res.status(404).json({ error: 'Imagen no encontrada' });
    }
});


const storageAlumno = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/img/alumnos');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const uploadAlumno = multer({ storage: storageAlumno });

// Ruta para el registro de alumnos sin verificación de reCAPTCHA
app.post('/alumnos', uploadAlumno.single('foto'), async (req, res) => {
    try {
        const nombre = req.body.nombre;
        const lastname = req.body.lastname;
        const correo = req.body.correo;
        const matricula = req.body.matricula;
        const carrera = req.body.carrera;
        const foto = req.file ? req.file.filename : null;
        const password = req.body.password;
        const idtarjeta = req.body.idtarjeta;

        // Verificar si ya existe un alumno con el mismo correo
        const results = await connection.query('SELECT * FROM alumno WHERE correo = ?', [correo]);

        if (results.length > 0) {
            return res.render('inicio', {
                alert: true,
                alertTitle: "Error",
                alertMessage: "¡El correo ya está registrado!",
                alertIcon: 'error',
                showConfirmButton: false,
                timer: 1500,
                ruta: ''
            });
        }

        // No existe un alumno con el mismo correo, proceder con el registro
        const passwordHash = await bcrypt.hash(password, 8);

        await connection.query('INSERT INTO alumno SET ?', {
            nombre: nombre,
            lastname: lastname,
            correo: correo,
            matricula: matricula,
            carrera: carrera,
            foto: foto,
            idtarjeta: idtarjeta,
            password: passwordHash
        });

        return res.render('inicio', {
            alert: true,
            alertTitle: "Registro",
            alertMessage: "¡Registro exitoso!",
            alertIcon: 'success',
            showConfirmButton: false,
            timer: 1500,
            ruta: ''
        });
    } catch (error) {
        console.error('Error durante el registro:', error);
        return res.render('inicio', {
            alert: true,
            alertTitle: "Error",
            alertMessage: "¡Ocurrió un error durante el registro!",
            alertIcon: 'error',
            showConfirmButton: false,
            timer: 1500,
            ruta: ''
        });
    }
});
////////////////////fin registrar alumnos//////////////////
app.post('/entradas', async (req, res) => {
    const idTarjeta = req.body.idtarjeta || idTarjetaWiFi;

    // Proceder con la inserción
    connection.query('INSERT INTO accesos SET ?', {
        idtarjeta: idTarjeta
    }, async (errorInsert, resultsInsert) => {
        if (errorInsert) {
            console.log(errorInsert);
            res.status(500).send('Error en el servidor');
        } else {
            // Registro exitoso
            res.render('inicio', {
                alert: true,
                alertTitle: "Recargando...",
                alertMessage: "buscando IDE Tarjeta",
                alertIcon: 'recharging',
                showConfirmButton: false,
                timer: 1500,
                ruta: 'entradas'
            });
        }
    });
});



///////////// Ruta para eliminar un alumno/////////////////
app.get('/eliminar/:id', (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); 
        return;
    }

    const alumnoId = req.params.id;
    connection.query('DELETE FROM alumno WHERE id = ?', [alumnoId], (error, results) => {
        if (error) {
            console.log(error);
            res.send('Error al eliminar el alumno');
        } else {
            res.redirect('/registros');
        }
    });
});
///////////// fIN Ruta para eliminar un alumno/////////////////

//////////// Ruta para editar un alumno //////////////////////
app.get('/editar/:id', (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); 
        return;
    }

    const alumnoId = req.params.id;
    connection.query('SELECT * FROM alumno WHERE id = ?', [alumnoId], (error, result) => {
        if (error) {
            console.log(error);
            res.send('Error al obtener los datos del alumno');
        } else {
            res.render('editaralumno', { alumno: result[0] });
        }
    });
});

app.post('/editar/:id', async (req, res) => {
    if (!req.session.loggedin) {
        res.redirect('/inicio'); // Redirigir a la página de inicio si no ha iniciado sesión
        return;
    }
    const id = req.params.id;
    const nombre = req.body.nombre;
    const apellido = req.body.apellido;
    const correo = req.body.correo;
   

    connection.query('UPDATE alumno SET nombre = ?, lastname = ?, correo = ? WHERE id = ?', [nombre, apellido, correo, id], (error, result) => {
        if (error) {
            console.log(error);
            res.send('Error al editar el alumno');
        } else {
            res.redirect('/registros');
        }
    });
});

//////////// fiN Ruta para editar un alumno //////////////////////
app.get('/registros/download', (req, res) => {
    if (req.session.loggedin) {
        const query = 'SELECT alumno.*, carrera.nombre AS nombre_carrera FROM alumno LEFT JOIN carrera ON alumno.carrera = carrera.id';

        connection.query(query, (error, results) => {
            if (error) {
                console.log(error);
                res.send('Error al obtener los datos');
            } else {
                
                const workbook = new ExcelJS.Workbook();
                const worksheet = workbook.addWorksheet('Registros');

              
                worksheet.columns = [
                    { header: 'Nombre', key: 'nombre', width: 15 },
                    { header: 'Apellido', key: 'lastname', width: 15 },
                    { header: 'Correo', key: 'correo', width: 30 },
                    { header: 'Matricula', key: 'matricula', width: 15 },
                    { header: 'ID tarjeta', key: 'idtarjeta', width: 20 },
                    { header: 'Carrera', key: 'nombre_carrera', width: 40 },
                ];

                results.forEach((alumno) => {
                    worksheet.addRow({
                        nombre: alumno.nombre,
                        lastname: alumno.lastname,
                        correo: alumno.correo,
                        matricula: alumno.matricula,
                        idtarjeta: alumno.idtarjeta || 'Sin datos',
                        nombre_carrera: alumno.nombre_carrera || 'Sin datos',
                    });
                });

               
                res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
                res.setHeader('Content-Disposition', 'attachment; filename=registros.xlsx');

                workbook.xlsx.write(res).then(() => {
                    res.end();
                });
            }
        });
    } else {
        res.redirect('/inicio');
    }
});


////////////////////////API/////////////////////////////////
app.use(cors());
// Usa body-parser para analizar las solicitudes en formato JSON
app.use(bodyParser.json());
// app.use('/api',index);

app.get('/api/administradores', (req, res) => {
    connection.query('SELECT * FROM administrador', (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener alumnos' });
        } else {
            res.status(200).json(results);
        }
    });
});
 
// Ruta para obtener un administrador por ID
app.get('/api/administradores/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM administrador WHERE id = ?', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener el administrador' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Administrador no encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

// Ruta para obtener todos los alumnos
app.get('/api/alumnos', (req, res) => {
    connection.query('SELECT * FROM alumno', (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener alumnos' });
        } else {
            res.status(200).json(results);
        }
    });
});

app.get('/api/alumno/:id', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM alumno WHERE id = ?', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener el alumno' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Alumno no encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});

//horas de acceso
app.get('/api/acceso', (req, res) => {
    const id = req.params.id;
    connection.query('SELECT * FROM accesos', [id], (error, results) => {
        if (error) {
            res.status(500).json({ error: 'Error al obtener los datos de la tabla de acceso' });
        } else {
            if (results.length === 0) {
                res.status(404).json({ error: 'Accesos encontrado' });
            } else {
                res.status(200).json(results[0]);
            }
        }
    });
});
app.get('/accesos', (req, res) => {
    connection.query('SELECT * FROM alumno INNER JOIN accesos ON alumno.idtarjeta = accesos.idtarjeta', (err, results) => {
        if (err) {
            console.error('Error al obtener los datos de los alumnos:', err);
            res.status(500).json({ error: 'Error al obtener los datos de los alumnos' });
            return;
        }
        res.json(results);
    });
});
app.get('/accesos/:matricula', (req, res) => {
    const matricula = req.params.matricula;
    connection.query('SELECT * FROM alumno INNER JOIN accesos ON alumno.idtarjeta = accesos.idtarjeta WHERE alumno.matricula = ?', matricula, (err, results) => {
        if (err) {
            console.error('Error al obtener los datos de los alumnos:', err);
            res.status(500).json({ error: 'Error al obtener los datos de los alumnos' });
            return;
        }
        res.json(results);
    });
});
app.get('/registros', (req, res) => {
    connection.query('SELECT * FROM alumno', (err, results) => {
        if (err) {
            console.error('Error al obtener registros:', err);
            res.status(500).json({ error: 'Error al obtener registros' });
            return;
        }
        res.json(results);
    });
});

///////////////////////////////////////LOGIN///////////////////////////////////////////////////
// Endpoint para autenticar un usuario (login)
// app.post('/login', (req, res) => {
//     const { correo, password } = req.body;
//     connection.query('SELECT * FROM alumno WHERE correo = ?', [correo], async (err, resultados) => {
//         if (err) {
//             console.error('Error al autenticar al usuario:', err);
//             res.status(500).json({ error: 'Error al autenticar al usuario' });
//             return;
//         }
//         if (resultados.length === 0) {
//             res.status(401).json({ error: 'Credenciales inválidas' });
//             return;
//         }
//         const usuario = resultados[0];
//         const contraseñaValida = await bcrypt.compare(password, usuario.password);
//         if (contraseñaValida) {
//             res.json({ userId: usuario.id }); // Devuelve el ID del usuario autenticado
//         } else {
//             res.status(401).json({ error: 'Credenciales inválidas' });
//         }
//     });
// });
app.post('/login', (req, res) => {
    const { correo, password } = req.body;
    connection.query('SELECT * FROM alumno WHERE correo = ?', [correo], async (err, resultados) => {
        if (err) {
            console.error('Error al autenticar al usuario:', err);
            res.status(500).json({ error: 'Error al autenticar al usuario' });
            return;
        }
        if (resultados.length === 0) {
            res.status(401).json({ error: 'Credenciales inválidas' });
            return;
        }
        const usuario = resultados[0];
        const contraseñaValida = await bcrypt.compare(password, usuario.password);
        if (contraseñaValida) {
            // Devuelve el ID del usuario autenticado junto con los datos del usuario
            res.json({ userId: usuario.id, userData: usuario }); 
        } else {
            res.status(401).json({ error: 'Credenciales inválidas' });
        }
    });
});

////////////GRAFICAS///////
// Endpoint para obtener el total de alumnos inscritos de cada carrera
app.get('/alumnos/total-por-carrera', (req, res) => {
    const sqlQuery = `
        SELECT carrera, COUNT(*) AS total_alumnos_inscritos
        FROM alumno
        GROUP BY carrera;
    `;
    connection.query(sqlQuery, (err, results) => {
        if (err) {
            console.error('Error al obtener total de alumnos por carrera:', err);
            res.status(500).json({ error: 'Error al obtener total de alumnos por carrera' });
            return;
        }
        res.json(results);
    });
});
/////////////////Fin de API/////////////////////////////

// Nueva variable para almacenar el UID de WiFi
let idTarjetaWiFi = '';


// Ruta para recibir el UID desde el ESP32 y emitir datos del alumno
app.post('/datos-distancia', (req, res) => {
    const { uid } = req.body;
        idTarjetaWiFi = uid; try {
       

        // Emitir datos del alumno al cliente a través de WebSocket
        emitirDatosAlumno(idTarjetaWiFi, io);

        // Puedes realizar otras acciones aquí si es necesario

        res.status(200).send('UID actualizado con éxito');
    } catch (error) {
        console.error('Error al procesar datos:', error);
        res.status(500).send('Error en el servidor');
    }
});


io.on('connection', (socket) => {
    console.log('Cliente conectado');

    //  Enviar el UID al cliente recién conectado
    if (idTarjetaWiFi) {
        socket.emit('idTarjetaWiFi ', idTarjetaWiFi);
    }

    socket.on('reloadPage', () => {
        // Emitir la señal para recargar la página a todos los clientes
        io.emit('reloadPage');
    });

    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});


// Función para obtener y emitir datos del alumno
function emitirDatosAlumno(idTarjeta, socket) {
    connection.query('SELECT * FROM alumno WHERE idtarjeta = ?', [idTarjeta], (error, results) => {
        if (error) {
            console.error('Error en la consulta de alumno:', error);
        } else {
            const alumnoData = results.length > 0 ? results[0] : null;
            // Emitir datos del alumno al cliente
            socket.emit('alumnoData', alumnoData);
        }
    });
}



app.get('/datos-distancia', (req, res) => {
    res.render('datos-distancia', { idTarjetaWiFi });
});


app.get('/datos-distancia/grafica', (req, res) => {
    connection.query('SELECT COUNT(*) as total FROM alumno', (error, results) => {
        if (error) {
            console.error('Error en la consulta de datos:', error);
            res.status(500).send('Error en el servidor');
        } else {
            const totalAlumnos = results[0].total;

            // Renderizar la vista con la gráfica
            res.render('grafica-pastel', { totalAlumnos });
        }
    });
});



app.get('/grafica-pastel', (req, res) => {
    res.render('grafica-pastel', { totalAlumnos: 0 }); // Inicialmente, sin datos
});



//////////////////////Cerrar Sesion///////////////////////////////
app.get('/logout', function (req, res) {
	req.session.destroy(() => {
	  res.redirect('inicio') // siempre se ejecutará después de que se destruya la sesión
	})
});
/////////////////////Fin Cerrar Sesion///////////////////////////////

////////////////////Servidor//////////////////////




//Configuracion para productivo
app.listen(process.env.PORT);

//Configuracion para Desarrolllo
//server.listen(3001, () => {
//    console.log("El servidor está ejecutándose en el puerto http://localhost:3001");
//});


///////////////Fin de servidor////////////////////////////
