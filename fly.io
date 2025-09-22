# Frontend
cd frontend
flyctl launch --name my-frontend --region bom

# Backend 1
cd ../server2
flyctl launch --name my-server2 --region bom

# Backend 2
cd ../stream
flyctl launch --name my-stream --region bom
