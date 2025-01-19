import axios from "axios";
import useAuth from "./useAuth";
import { useLocation } from "react-router-dom";
import { useEffect } from "react";

export const axiosSecure = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    withCredentials: true,
})


const UseAxiosSecure = () => {
    const { logOut } = useAuth()
    const navigate = useLocation()
   useEffect(() => {
    axiosSecure.interceptors.response.use(
        res => {
            return res
        },
        async error => {
            console.log('error cought form our very own axios interceptore', error.response)
            if(error.response.status === 401 || error.response.status === 403){
                logOut()
                navigate('/login')
            }
        }
    )
},[logOut, navigate])
return axiosSecure
};

export default UseAxiosSecure;