#!/bin/bash
set -e

cd /usr/local/ant-media-server

# Set JAVA_HOME
export JAVA_HOME=/opt/java/openjdk
export PATH=$JAVA_HOME/bin:$PATH

# Build classpath
RED5_HOME=/usr/local/ant-media-server
RED5_CLASSPATH="${RED5_HOME}/ant-media-server.jar"
for jar in ${RED5_HOME}/lib/*.jar; do
    RED5_CLASSPATH="${RED5_CLASSPATH}:${jar}"
done

# Export variables for execution
export RED5_HOME
export RED5_CLASSPATH
export RED5_MAINCLASS=org.red5.server.Bootstrap
export RED5_OPTS=9999

# JVM Options (Java 21 compatible)
MEMORY_OPTIONS="-Xms1G -Xmx4G"
JVM_OPTS="${MEMORY_OPTIONS} -Djava.io.tmpdir=/tmp -Djava.awt.headless=true -XX:+HeapDumpOnOutOfMemoryError -XX:+TieredCompilation -XX:InitialCodeCacheSize=8m -XX:ReservedCodeCacheSize=32m -XX:MaxMetaspaceSize=128m -XX:+UseG1GC -XX:MaxGCPauseMillis=100 -XX:ParallelGCThreads=10 -XX:ConcGCThreads=5 -Djava.system.class.loader=org.red5.server.classloading.ServerClassLoader"
SECURITY_OPTS="-Djava.security.egd=file:/dev/./urandom"
TOMCAT_OPTS="-Dcatalina.home=${RED5_HOME} -Dcatalina.useNaming=true -Djava.net.preferIPv4Stack=true"
NATIVE="-Djava.library.path=${RED5_HOME}/lib/native-linux-x86_64:${RED5_HOME}/lib/native"
JYTHON="-Dpython.home=lib"

JAVA_OPTS="${SECURITY_OPTS} ${JVM_OPTS} ${TOMCAT_OPTS} ${NATIVE} ${JYTHON}"

echo "Starting Ant Media Server"
echo "Red5 Home: ${RED5_HOME}"
echo "Classpath: ${RED5_CLASSPATH}"

# Run in foreground
exec ${JAVA_HOME}/bin/java -Dred5.root="${RED5_HOME}" ${JAVA_OPTS} -cp "${RED5_CLASSPATH}" "${RED5_MAINCLASS}" ${RED5_OPTS}
